package payload_test

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/MacroPower/macropower-analytics-panel/server/cacher"
	"github.com/MacroPower/macropower-analytics-panel/server/payload"
	"github.com/MacroPower/macropower-analytics-panel/server/payloadtest"
	"github.com/go-kit/kit/log"
)

var (
	logBuffer = payloadtest.SafeBuffer{}
	logger    = log.NewLogfmtLogger(log.NewSyncWriter(&logBuffer))
	cache     = cacher.NewCache()
)

func newTestServer() *httptest.Server {
	handler := payload.NewHandler(cache, 10, true, true, logger)
	testserver := httptest.NewServer(handler)

	return testserver
}

func TestHandler(t *testing.T) {
	testserver := newTestServer()
	defer testserver.Close()

	request := payloadtest.GetPayload(t)
	request.Type = "start"
	payloadtest.SendPayload(t, testserver.URL, request)
	time.Sleep(100 * time.Millisecond)

	t.Log(logBuffer.String())
	logBuffer.Reset()
}

func TestPayloadLifecycle(t *testing.T) {
	testserver := newTestServer()
	defer testserver.Close()

	var request payload.Payload

	request = payloadtest.GetPayload(t)
	request.UUID = "test"
	request.Type = "start"
	request.Time = 1600000000
	payloadtest.SendPayload(t, testserver.URL, request)

	request = payloadtest.GetPayload(t)
	request.UUID = "test"
	request.Type = "end"
	request.Time = 1600007200
	payloadtest.SendPayload(t, testserver.URL, request)

	time.Sleep(100 * time.Millisecond)

	p1, exists := cache.Get("test")
	if !exists {
		t.Fatal("Expected cache to contain item for payload")
	}
	p := p1.(payload.Payload)
	actual := p.GetDuration(time.Duration(0))
	expected := 2 * time.Hour
	if expected != actual {
		t.Errorf("Expected the duration '%s', got '%s'\n", expected.String(), actual.String())
	}

	t.Log(logBuffer.String())
	logBuffer.Reset()
}

func TestPayloadHeartbeat(t *testing.T) {
	testserver := newTestServer()
	defer testserver.Close()

	var request payload.Payload
	heartbeatInterval := 3600

	request = payloadtest.GetPayload(t)
	request.UUID = "test"
	request.Type = "heartbeat"
	request.Time = 1600000001
	request.Options.HeartbeatInterval = heartbeatInterval
	payloadtest.SendPayload(t, testserver.URL, request)

	request = payloadtest.GetPayload(t)
	request.UUID = "test"
	request.Type = "heartbeat"
	request.Time = 1600000000
	request.Options.HeartbeatInterval = heartbeatInterval
	payloadtest.SendPayload(t, testserver.URL, request)

	request = payloadtest.GetPayload(t)
	request.UUID = "test"
	request.Type = "heartbeat"
	request.Time = 1600007200
	request.Options.HeartbeatInterval = heartbeatInterval
	payloadtest.SendPayload(t, testserver.URL, request)

	time.Sleep(100 * time.Millisecond)

	p1, exists := cache.Get("test")
	if !exists {
		t.Fatal("Expected cache to contain item for payload")
	}
	p := p1.(payload.Payload)

	// Gathering the duration should have no side effects.
	_ = p.GetDuration(time.Duration(0))
	_ = p.GetDuration(time.Duration(0))
	_ = p.GetDuration(time.Hour)
	_ = p.GetDuration(time.Duration(0))
	time.Sleep(100 * time.Millisecond)

	actual := p.GetDuration(time.Duration(0))
	expected := time.Hour + (time.Minute * 15) + time.Second
	if expected != actual {
		t.Errorf("Expected the duration '%s', got '%s'\n", expected.String(), actual.String())
	}

	t.Log(logBuffer.String())
	logBuffer.Reset()
}
