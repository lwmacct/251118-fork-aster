package server

import (
	"github.com/astercloud/aster/server/handlers"
	"github.com/gin-gonic/gin"
)

// registerAgentRoutes registers all agent-related routes
func (s *Server) registerAgentRoutes(rg *gin.RouterGroup) {
	// Create agent handler
	h := handlers.NewAgentHandler(s.store, s.deps.AgentDeps)

	agents := rg.Group("/agents")
	{
		agents.POST("", h.Create)
		agents.GET("", h.List)
		agents.GET("/:id", h.Get)
		agents.PATCH("/:id", h.Update)
		agents.DELETE("/:id", h.Delete)
		agents.POST("/chat", h.Chat)
		agents.POST("/chat/stream", h.StreamChat)
		agents.GET("/:id/stats", h.GetStats)
	}
}

// registerMemoryRoutes registers all memory-related routes
func (s *Server) registerMemoryRoutes(rg *gin.RouterGroup) {
	// Create memory handler
	h := handlers.NewMemoryHandler(s.store)

	memory := rg.Group("/memory")
	{
		// Working memory
		working := memory.Group("/working")
		{
			working.POST("", h.CreateWorkingMemory)
			working.GET("", h.ListWorkingMemory)
			working.GET("/:id", h.GetWorkingMemory)
			working.PATCH("/:id", h.UpdateWorkingMemory)
			working.DELETE("/:id", h.DeleteWorkingMemory)
			working.POST("/clear", h.ClearWorkingMemory)
		}

		// Semantic memory
		semantic := memory.Group("/semantic")
		{
			semantic.POST("", h.CreateSemanticMemory)
			semantic.POST("/search", h.SearchSemanticMemory)
		}

		// Provenance
		memory.GET("/provenance/:id", h.GetProvenance)

		// Consolidation
		memory.POST("/consolidate", h.ConsolidateMemory)
	}
}

// registerSessionRoutes registers all session-related routes
func (s *Server) registerSessionRoutes(rg *gin.RouterGroup) {
	// Create session handler
	h := handlers.NewSessionHandler(s.store)

	sessions := rg.Group("/sessions")
	{
		sessions.POST("", h.Create)
		sessions.GET("", h.List)
		sessions.GET("/:id", h.Get)
		sessions.PATCH("/:id", h.Update)
		sessions.DELETE("/:id", h.Delete)
		sessions.GET("/:id/messages", h.GetMessages)
		sessions.GET("/:id/checkpoints", h.GetCheckpoints)
		sessions.POST("/:id/resume", h.Resume)
		sessions.GET("/:id/stats", h.GetStats)
	}
}

// registerWorkflowRoutes registers all workflow-related routes
func (s *Server) registerWorkflowRoutes(rg *gin.RouterGroup) {
	// Create workflow handler
	h := handlers.NewWorkflowHandler(s.store)

	workflows := rg.Group("/workflows")
	{
		workflows.POST("", h.Create)
		workflows.GET("", h.List)
		workflows.GET("/:id", h.Get)
		workflows.PATCH("/:id", h.Update)
		workflows.DELETE("/:id", h.Delete)
		workflows.POST("/:id/execute", h.Execute)
		workflows.POST("/:id/suspend", h.Suspend)
		workflows.POST("/:id/resume", h.Resume)
		workflows.GET("/:id/executions", h.GetExecutions)
		workflows.GET("/:id/executions/:eid", h.GetExecutionDetails)
	}
}

// registerToolRoutes registers all tool-related routes
func (s *Server) registerToolRoutes(rg *gin.RouterGroup) {
	// Create tool handler
	h := handlers.NewToolHandler(s.store)

	tools := rg.Group("/tools")
	{
		tools.POST("", h.Create)
		tools.GET("", h.List)
		tools.GET("/:id", h.Get)
		tools.PATCH("/:id", h.Update)
		tools.DELETE("/:id", h.Delete)
		tools.POST("/:id/execute", h.Execute)
	}
}

// registerMiddlewareRoutes registers all middleware-related routes
func (s *Server) registerMiddlewareRoutes(rg *gin.RouterGroup) {
	// Create middleware handler
	h := handlers.NewMiddlewareHandler(s.store)

	middlewares := rg.Group("/middlewares")
	{
		// Basic CRUD
		middlewares.POST("", h.Create)
		middlewares.GET("", h.List)
		middlewares.GET("/:id", h.Get)
		middlewares.PATCH("/:id", h.Update)
		middlewares.DELETE("/:id", h.Delete)

		// Management operations
		middlewares.POST("/:id/enable", h.Enable)
		middlewares.POST("/:id/disable", h.Disable)
		middlewares.POST("/:id/reload", h.Reload)
		middlewares.GET("/:id/stats", h.GetStats)

		// Registry
		registry := middlewares.Group("/registry")
		{
			registry.GET("", h.ListRegistry)
			registry.POST("/:id/install", h.Install)
			registry.DELETE("/:id/uninstall", h.Uninstall)
			registry.GET("/:id/info", h.GetInfo)
			registry.POST("/reload-all", h.ReloadAll)
		}
	}
}

// registerTelemetryRoutes registers all telemetry-related routes
func (s *Server) registerTelemetryRoutes(rg *gin.RouterGroup) {
	// Create telemetry handler
	h := handlers.NewTelemetryHandler(s.store)

	telemetry := rg.Group("/telemetry")
	{
		// Metrics
		telemetry.POST("/metrics", h.RecordMetric)
		telemetry.GET("/metrics", h.ListMetrics)

		// Traces
		telemetry.POST("/traces", h.RecordTrace)
		telemetry.POST("/traces/query", h.QueryTraces)

		// Logs
		telemetry.POST("/logs", h.RecordLog)
		telemetry.POST("/logs/query", h.QueryLogs)
	}
}

// registerEvalRoutes registers all eval-related routes
func (s *Server) registerEvalRoutes(rg *gin.RouterGroup) {
	// Create eval handler
	h := handlers.NewEvalHandler(s.store)

	eval := rg.Group("/eval")
	{
		// Evaluation runs
		eval.POST("/text", h.RunTextEval)
		eval.POST("/session", h.RunSessionEval)
		eval.POST("/batch", h.RunBatchEval)
		eval.POST("/custom", h.RunCustomEval)

		// Evaluation management
		evals := eval.Group("/evals")
		{
			evals.GET("", h.ListEvals)
			evals.GET("/:id", h.GetEval)
			evals.DELETE("/:id", h.DeleteEval)
		}

		// Benchmarks
		benchmarks := eval.Group("/benchmarks")
		{
			benchmarks.POST("", h.CreateBenchmark)
			benchmarks.GET("", h.ListBenchmarks)
			benchmarks.GET("/:id", h.GetBenchmark)
			benchmarks.DELETE("/:id", h.DeleteBenchmark)
			benchmarks.POST("/:id/run", h.RunBenchmark)
		}
	}
}

// registerMCPRoutes registers all MCP-related routes
func (s *Server) registerMCPRoutes(rg *gin.RouterGroup) {
	// Create MCP handler
	h := handlers.NewMCPHandler(s.store)

	mcp := rg.Group("/mcp")
	{
		servers := mcp.Group("/servers")
		{
			servers.POST("", h.Create)
			servers.GET("", h.List)
			servers.GET("/:id", h.Get)
			servers.PATCH("/:id", h.Update)
			servers.DELETE("/:id", h.Delete)
			servers.POST("/:id/connect", h.Connect)
			servers.POST("/:id/disconnect", h.Disconnect)
		}
	}
}

// registerSystemRoutes registers all system-related routes
func (s *Server) registerSystemRoutes(rg *gin.RouterGroup) {
	// Create system handler
	h := handlers.NewSystemHandler(s.store)

	system := rg.Group("/system")
	{
		// Configuration management
		config := system.Group("/config")
		{
			config.GET("", h.ListConfig)
			config.GET("/:key", h.GetConfig)
			config.PUT("/:key", h.UpdateConfig)
			config.DELETE("/:key", h.DeleteConfig)
		}

		// System operations
		system.GET("/info", h.GetInfo)
		system.GET("/health", h.GetHealth)
		system.GET("/stats", h.GetStats)
		system.POST("/reload", h.Reload)
		system.POST("/gc", h.RunGC)
		system.POST("/backup", h.Backup)
	}
}
