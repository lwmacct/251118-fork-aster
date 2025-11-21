package server

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"sync"
	"time"

	"github.com/astercloud/aster/pkg/asteros"
	"github.com/gin-gonic/gin"
)

//go:embed ../web
var webFS embed.FS

// Server UI WebSocket 服务器
type Server struct {
	asteros *asteros.AsterOS
	router  *gin.Engine
	server  *http.Server
	hub     *Hub
	config  *Config

	running bool
	mu      sync.RWMutex
}

// Config UI 服务器配置
type Config struct {
	Port        int
	Host        string
	AsterOS     *asteros.AsterOS
	EnableCORS  bool
	EnableAuth  bool
	APIKey      string
	StaticPath  string // 自定义静态文件路径 (可选)
}

// DefaultConfig 默认配置
func DefaultConfig(os *asteros.AsterOS) *Config {
	return &Config{
		Port:       3000,
		Host:       "0.0.0.0",
		AsterOS:    os,
		EnableCORS: true,
		EnableAuth: false,
	}
}

// New 创建 UI 服务器
func New(config *Config) *Server {
	if config == nil {
		panic("config is required")
	}

	// 设置 Gin 模式
	gin.SetMode(gin.ReleaseMode)

	s := &Server{
		asteros: config.AsterOS,
		router:  gin.New(),
		hub:     NewHub(),
		config:  config,
	}

	s.initRoutes()
	return s
}

// initRoutes 初始化路由
func (s *Server) initRoutes() {
	// 中间件
	s.router.Use(gin.Logger())
	s.router.Use(gin.Recovery())

	if s.config.EnableCORS {
		s.router.Use(corsMiddleware())
	}

	// WebSocket
	s.router.GET("/ws", s.handleWebSocket)

	// API 代理
	api := s.router.Group("/api")
	{
		api.GET("/agents", s.handleListAgents)
		api.POST("/agents/:id/send", s.handleAgentSend)
		api.GET("/rooms", s.handleListRooms)
		api.POST("/rooms/:id/say", s.handleRoomSay)
		api.GET("/pool/stats", s.handlePoolStats)
	}

	// 静态文件
	s.serveStatic()
}

// serveStatic 提供静态文件
func (s *Server) serveStatic() {
	if s.config.StaticPath != "" {
		// 使用自定义路径
		s.router.Static("/", s.config.StaticPath)
	} else {
		// 使用嵌入的文件系统
		webRoot, _ := fs.Sub(webFS, "web")
		s.router.StaticFS("/", http.FS(webRoot))
	}
}

// Serve 启动服务器
func (s *Server) Serve() error {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return fmt.Errorf("server already running")
	}
	s.running = true
	s.mu.Unlock()

	// 启动 Hub
	go s.hub.Run()

	// 创建 HTTP 服务器
	s.server = &http.Server{
		Addr:    fmt.Sprintf("%s:%d", s.config.Host, s.config.Port),
		Handler: s.router,
	}

	fmt.Printf("🎨 AsterUI is running on http://localhost:%d\n", s.config.Port)

	if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("listen and serve: %w", err)
	}

	return nil
}

// Shutdown 关闭服务器
func (s *Server) Shutdown() error {
	s.mu.Lock()
	if !s.running {
		s.mu.Unlock()
		return fmt.Errorf("server not running")
	}
	s.running = false
	s.mu.Unlock()

	// 关闭 Hub
	s.hub.Stop()

	// 关闭 HTTP 服务器
	if s.server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return s.server.Shutdown(ctx)
	}

	return nil
}

// corsMiddleware CORS 中间件
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
