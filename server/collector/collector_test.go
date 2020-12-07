package collector_test

import (
	"bytes"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/MacroPower/macropower-analytics-panel/server/cacher"
	"github.com/MacroPower/macropower-analytics-panel/server/collector"
	"github.com/MacroPower/macropower-analytics-panel/server/payload"
	"github.com/go-kit/kit/log"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	payloadURL     = "/write"
	metricsURL     = "/metrics"
	logger         = log.NewLogfmtLogger(log.NewSyncWriter(os.Stdout))
	cache          = cacher.NewCache(10, logger)
	metricExporter = collector.NewExporter(cache, time.Hour, logger)
)

func init() {
	prometheus.MustRegister(metricExporter)
}

func sendPayload(t *testing.T, url string, p payload.Payload) {
	requestByte, _ := json.Marshal(p)
	requestReader := bytes.NewReader(requestByte)

	resp, err := http.Post(url+payloadURL, "application/json", requestReader)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 201 {
		t.Fatalf("Received non-201 response: %d\n", resp.StatusCode)
	}

	expected := ""
	actual, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	if expected != string(actual) {
		t.Errorf("Expected the message '%s'\n", expected)
	}
}

func getMetrics(t *testing.T, url string) string {
	resp, err := http.Get(url + metricsURL)
	if err != nil {
		t.Fatal(err)
	}

	metricBytes, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}

	return string(metricBytes)
}

func newMux() *http.ServeMux {
	mux := http.NewServeMux()

	handler := payload.NewHandler(cache, true, true, logger)
	mux.Handle(payloadURL, handler)

	mux.Handle(metricsURL, promhttp.Handler())

	return mux
}

func TestSessionsTotal(t *testing.T) {
	testserver := httptest.NewServer(newMux())
	defer testserver.Close()

	request1 := payload.Payload{
		UUID: "test1",
		Type: "start",
	}
	sendPayload(t, testserver.URL, request1)
	request2 := payload.Payload{
		UUID: "test2",
		Type: "start",
	}
	sendPayload(t, testserver.URL, request2)
	time.Sleep(100 * time.Millisecond)

	m := getMetrics(t, testserver.URL)

	expectedSessionsTotal := `grafana_analytics_sessions_total{dashboard_name="",dashboard_timezone="",dashboard_uid="",grafana_env="",grafana_host=":",user_locale="",user_login="",user_name="",user_role="user",user_theme="dark",user_timezone=""} 2`
	if !strings.Contains(m, expectedSessionsTotal) {
		t.Errorf("Expected metrics to contain '%s', got:\n%s", expectedSessionsTotal, m)
	}

	notExpectedDurationSeconds := "grafana_analytics_sessions_duration_seconds"
	if strings.Contains(m, notExpectedDurationSeconds) {
		t.Errorf("Expected metrics to not contain '%s', got:\n%s", notExpectedDurationSeconds, m)
	}

	cache.Flush()
}

func TestDurationSeconds(t *testing.T) {
	testserver := httptest.NewServer(newMux())
	defer testserver.Close()

	request1 := payload.Payload{}
	request1.UUID = "test1"
	request1.Type = "start"
	request1.Dashboard.UID = "test123"
	request1.Time = 1600000001
	request1.TimeOrigin = 1600000000
	sendPayload(t, testserver.URL, request1)
	time.Sleep(500 * time.Millisecond)

	request2 := payload.Payload{}
	request2.UUID = "test1"
	request2.Type = "end"
	request2.Dashboard.UID = "test123"
	request2.Time = 1600007200
	sendPayload(t, testserver.URL, request2)
	time.Sleep(500 * time.Millisecond)

	m := getMetrics(t, testserver.URL)

	expectedSessionsTotal := `grafana_analytics_sessions_total{dashboard_name="",dashboard_timezone="",dashboard_uid="test123",grafana_env="",grafana_host=":",user_locale="",user_login="",user_name="",user_role="user",user_theme="dark",user_timezone=""} 1`
	if !strings.Contains(m, expectedSessionsTotal) {
		t.Errorf("Expected metrics to contain '%s', got:\n%s", expectedSessionsTotal, m)
	}

	expectedDurationSeconds := `grafana_analytics_sessions_duration_seconds{dashboard_name="",dashboard_timezone="",dashboard_uid="test123",grafana_env="",grafana_host=":",user_locale="",user_login="",user_name="",user_role="user",user_theme="dark",user_timezone=""} 7200`
	if !strings.Contains(m, expectedDurationSeconds) {
		t.Errorf("Expected metrics to contain '%s', got:\n%s", expectedDurationSeconds, m)
	}

	cache.Flush()
}
