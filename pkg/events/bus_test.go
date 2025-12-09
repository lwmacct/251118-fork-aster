package events

import (
	"testing"
	"time"

	"github.com/astercloud/aster/pkg/types"
)

func TestNewEventBus(t *testing.T) {
	eb := NewEventBus()
	defer eb.Close()

	if eb.config == nil {
		t.Error("config should not be nil")
	}
	if eb.config.MaxTimelineSize != 10000 {
		t.Errorf("expected MaxTimelineSize 10000, got %d", eb.config.MaxTimelineSize)
	}
}

func TestNewEventBusWithConfig(t *testing.T) {
	config := &EventBusConfig{
		MaxTimelineSize: 100,
		MaxTimelineAge:  10 * time.Minute,
		CleanupInterval: 1 * time.Minute,
	}
	eb := NewEventBusWithConfig(config)
	defer eb.Close()

	if eb.config.MaxTimelineSize != 100 {
		t.Errorf("expected MaxTimelineSize 100, got %d", eb.config.MaxTimelineSize)
	}
}

func TestEmitAndSubscribe(t *testing.T) {
	eb := NewEventBus()
	defer eb.Close()

	ch := eb.Subscribe([]types.AgentChannel{types.ChannelProgress}, nil)

	// Emit event
	eb.EmitProgress(&types.ProgressTextChunkEvent{Step: 1, Delta: "hello"})

	select {
	case env := <-ch:
		if env.Cursor != 1 {
			t.Errorf("expected cursor 1, got %d", env.Cursor)
		}
	case <-time.After(time.Second):
		t.Error("timeout waiting for event")
	}
}

func TestCleanupBySize(t *testing.T) {
	config := &EventBusConfig{
		MaxTimelineSize: 5,
		MaxTimelineAge:  0, // disable age cleanup
		CleanupInterval: 0, // disable auto cleanup
	}
	eb := NewEventBusWithConfig(config)
	defer eb.Close()

	// Emit 10 events
	for i := 0; i < 10; i++ {
		eb.EmitProgress(&types.ProgressTextChunkEvent{Step: i, Delta: "test"})
	}

	// Manual cleanup
	eb.cleanup()

	eb.mu.RLock()
	timelineLen := len(eb.timeline)
	bookmarksLen := len(eb.bookmarks)
	eb.mu.RUnlock()

	if timelineLen != 5 {
		t.Errorf("expected timeline length 5, got %d", timelineLen)
	}
	if bookmarksLen != 5 {
		t.Errorf("expected bookmarks length 5, got %d", bookmarksLen)
	}
}

func TestCleanupByAge(t *testing.T) {
	config := &EventBusConfig{
		MaxTimelineSize: 0, // disable size cleanup
		MaxTimelineAge:  2 * time.Second,
		CleanupInterval: 0, // disable auto cleanup
	}
	eb := NewEventBusWithConfig(config)
	defer eb.Close()

	// Emit events
	eb.EmitProgress(&types.ProgressTextChunkEvent{Step: 1, Delta: "old"})
	eb.EmitProgress(&types.ProgressTextChunkEvent{Step: 2, Delta: "old"})

	// Manually set old timestamps (Bookmark.Timestamp is in seconds)
	eb.mu.Lock()
	oldTime := time.Now().Add(-5 * time.Second).Unix()
	for i := range eb.timeline {
		eb.timeline[i].Bookmark.Timestamp = oldTime
	}
	eb.mu.Unlock()

	// Emit new event (will have current timestamp)
	eb.EmitProgress(&types.ProgressTextChunkEvent{Step: 3, Delta: "new"})

	// Manual cleanup
	eb.cleanup()

	eb.mu.RLock()
	timelineLen := len(eb.timeline)
	eb.mu.RUnlock()

	if timelineLen != 1 {
		t.Errorf("expected timeline length 1, got %d", timelineLen)
	}
}

func TestUnsubscribe(t *testing.T) {
	eb := NewEventBus()
	defer eb.Close()

	ch := eb.Subscribe([]types.AgentChannel{types.ChannelProgress}, nil)
	eb.Unsubscribe(ch)

	eb.mu.RLock()
	subsLen := len(eb.progressSubs)
	eb.mu.RUnlock()

	if subsLen != 0 {
		t.Errorf("expected 0 subscribers, got %d", subsLen)
	}
}

func TestRandomString(t *testing.T) {
	s1 := randomString(8)
	s2 := randomString(8)

	if len(s1) != 8 {
		t.Errorf("expected length 8, got %d", len(s1))
	}
	if s1 == s2 {
		t.Error("random strings should be different")
	}
}

func TestClose(t *testing.T) {
	eb := NewEventBus()
	ch := eb.Subscribe([]types.AgentChannel{types.ChannelProgress}, nil)

	eb.Close()

	// Channel should be closed
	select {
	case _, ok := <-ch:
		if ok {
			t.Error("channel should be closed")
		}
	case <-time.After(100 * time.Millisecond):
		t.Error("channel read should not block")
	}
}
