package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/astercloud/aster/pkg/agent"
	"github.com/astercloud/aster/pkg/logging"
	"github.com/astercloud/aster/pkg/store"
	"github.com/astercloud/aster/pkg/types"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for development
		// TODO: Configure allowed origins in production
		return true
	},
}

// WebSocketHandler handles WebSocket connections
type WebSocketHandler struct {
	store *store.Store
	deps  *agent.Dependencies
	
	// Connection management
	connections map[string]*WebSocketConnection
	mu          sync.RWMutex
}

// WebSocketConnection represents a single WebSocket connection
type WebSocketConnection struct {
	ID     string
	Conn   *websocket.Conn
	Send   chan []byte
	Agent  *agent.Agent
	ctx    context.Context
	cancel context.CancelFunc
}

// WebSocketMessage represents a message sent over WebSocket
type WebSocketMessage struct {
	Type    string                 `json:"type"`
	Payload map[string]interface{} `json:"payload"`
}

// NewWebSocketHandler creates a new WebSocketHandler
func NewWebSocketHandler(st store.Store, deps *agent.Dependencies) *WebSocketHandler {
	return &WebSocketHandler{
		store:       &st,
		deps:        deps,
		connections: make(map[string]*WebSocketConnection),
	}
}

// HandleWebSocket handles WebSocket upgrade and communication
func (h *WebSocketHandler) HandleWebSocket(c *gin.Context) {
	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		logging.Error(c.Request.Context(), "websocket.upgrade.failed", map[string]interface{}{
			"error": err.Error(),
		})
		return
	}

	// Create connection context
	ctx, cancel := context.WithCancel(context.Background())
	
	// Create connection object
	wsConn := &WebSocketConnection{
		ID:     fmt.Sprintf("ws-%d", time.Now().UnixNano()),
		Conn:   conn,
		Send:   make(chan []byte, 256),
		ctx:    ctx,
		cancel: cancel,
	}

	// Register connection
	h.mu.Lock()
	h.connections[wsConn.ID] = wsConn
	h.mu.Unlock()

	logging.Info(ctx, "websocket.connected", map[string]interface{}{
		"connection_id": wsConn.ID,
	})

	// Start write pump in goroutine
	go h.writePump(wsConn)
	
	// Run read pump in current goroutine (blocks until connection closes)
	h.readPump(wsConn)
}

// readPump reads messages from the WebSocket connection
func (h *WebSocketHandler) readPump(wsConn *WebSocketConnection) {
	defer func() {
		h.closeConnection(wsConn)
	}()

	wsConn.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	wsConn.Conn.SetPongHandler(func(string) error {
		wsConn.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := wsConn.Conn.ReadMessage()
		if err != nil {
			logging.Info(wsConn.ctx, "websocket.read.closed", map[string]interface{}{
				"connection_id": wsConn.ID,
				"error":         err.Error(),
			})
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				logging.Error(wsConn.ctx, "websocket.read.error", map[string]interface{}{
					"connection_id": wsConn.ID,
					"error":         err.Error(),
				})
			}
			break
		}

		logging.Info(wsConn.ctx, "websocket.message.received", map[string]interface{}{
			"connection_id": wsConn.ID,
			"message":       string(message),
		})

		// Parse message
		var msg WebSocketMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			h.sendError(wsConn, "invalid_message", "Failed to parse message")
			continue
		}

		// Handle message based on type
		h.handleMessage(wsConn, &msg)
	}
}

// writePump writes messages to the WebSocket connection
func (h *WebSocketHandler) writePump(wsConn *WebSocketConnection) {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		wsConn.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-wsConn.Send:
			wsConn.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				wsConn.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := wsConn.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			wsConn.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := wsConn.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}

		case <-wsConn.ctx.Done():
			return
		}
	}
}

// handleMessage handles different message types
func (h *WebSocketHandler) handleMessage(wsConn *WebSocketConnection, msg *WebSocketMessage) {
	switch msg.Type {
	case "chat":
		h.handleChat(wsConn, msg.Payload)
	case "ping":
		h.sendMessage(wsConn, "pong", nil)
	default:
		h.sendError(wsConn, "unknown_message_type", fmt.Sprintf("Unknown message type: %s", msg.Type))
	}
}

// handleChat handles chat messages
func (h *WebSocketHandler) handleChat(wsConn *WebSocketConnection, payload map[string]interface{}) {
	// Extract parameters
	templateID, _ := payload["template_id"].(string)
	if templateID == "" {
		templateID = "chat"
	}

	input, _ := payload["input"].(string)
	if input == "" {
		h.sendError(wsConn, "missing_input", "Input message is required")
		return
	}

	// Create agent configuration
	cfg := &types.AgentConfig{
		TemplateID: templateID,
	}

	// Handle model config if provided
	if modelConfigData, ok := payload["model_config"].(map[string]interface{}); ok {
		modelConfig := &types.ModelConfig{}
		if provider, ok := modelConfigData["provider"].(string); ok {
			modelConfig.Provider = provider
		}
		if model, ok := modelConfigData["model"].(string); ok {
			modelConfig.Model = model
		}
		if apiKey, ok := modelConfigData["api_key"].(string); ok {
			modelConfig.APIKey = apiKey
		}
		
		// Fill API key from environment if missing
		if modelConfig.APIKey == "" && modelConfig.Provider != "" {
			var envKey string
			switch modelConfig.Provider {
			case "deepseek":
				envKey = os.Getenv("DEEPSEEK_API_KEY")
			case "anthropic":
				envKey = os.Getenv("ANTHROPIC_API_KEY")
			case "openai":
				envKey = os.Getenv("OPENAI_API_KEY")
			default:
				envKey = os.Getenv(strings.ToUpper(modelConfig.Provider) + "_API_KEY")
			}
			if envKey != "" {
				modelConfig.APIKey = envKey
			}
		}
		
		cfg.ModelConfig = modelConfig
	}

	// Create agent instance
	ag, err := agent.Create(wsConn.ctx, cfg, h.deps)
	if err != nil {
		h.sendError(wsConn, "agent_creation_failed", err.Error())
		return
	}
	wsConn.Agent = ag

	// Send start event
	h.sendMessage(wsConn, "chat_start", map[string]interface{}{
		"agent_id": ag.ID(),
	})

	// Stream response
	go func() {
		defer func() {
			if wsConn.Agent != nil {
				(*wsConn.Agent).Close()
			}
		}()

		for event, err := range ag.Stream(wsConn.ctx, input) {
			if err != nil {
				logging.Error(wsConn.ctx, "stream.error", map[string]interface{}{
					"agent_id": ag.ID(),
					"error":    err.Error(),
				})
				h.sendError(wsConn, "stream_error", err.Error())
				break
			}

			if event != nil {
				// Extract text content from event
				var textContent string
				for _, block := range event.Content.ContentBlocks {
					if tb, ok := block.(*types.TextBlock); ok {
						textContent += tb.Text
					}
				}

				if textContent != "" {
					h.sendMessage(wsConn, "text_delta", map[string]interface{}{
						"text": textContent,
					})
				}
			}
		}

		// Send completion event
		h.sendMessage(wsConn, "chat_complete", map[string]interface{}{
			"agent_id": ag.ID(),
		})

		logging.Info(wsConn.ctx, "chat.completed", map[string]interface{}{
			"agent_id": ag.ID(),
		})
	}()
}

// sendMessage sends a message to the WebSocket client
func (h *WebSocketHandler) sendMessage(wsConn *WebSocketConnection, msgType string, payload map[string]interface{}) {
	msg := WebSocketMessage{
		Type:    msgType,
		Payload: payload,
	}

	data, err := json.Marshal(msg)
	if err != nil {
		logging.Error(wsConn.ctx, "websocket.marshal.error", map[string]interface{}{
			"error": err.Error(),
		})
		return
	}

	select {
	case wsConn.Send <- data:
	case <-wsConn.ctx.Done():
	default:
		// Channel full, skip message
		logging.Warn(wsConn.ctx, "websocket.send.dropped", map[string]interface{}{
			"connection_id": wsConn.ID,
			"message_type":  msgType,
		})
	}
}

// sendError sends an error message to the WebSocket client
func (h *WebSocketHandler) sendError(wsConn *WebSocketConnection, code, message string) {
	h.sendMessage(wsConn, "error", map[string]interface{}{
		"code":    code,
		"message": message,
	})
}

// closeConnection closes a WebSocket connection
func (h *WebSocketHandler) closeConnection(wsConn *WebSocketConnection) {
	h.mu.Lock()
	delete(h.connections, wsConn.ID)
	h.mu.Unlock()

	wsConn.cancel()
	close(wsConn.Send)

	if wsConn.Agent != nil {
		(*wsConn.Agent).Close()
	}

	logging.Info(wsConn.ctx, "websocket.disconnected", map[string]interface{}{
		"connection_id": wsConn.ID,
	})
}

// GetStats returns WebSocket statistics
func (h *WebSocketHandler) GetStats(c *gin.Context) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"active_connections": len(h.connections),
		},
	})
}
