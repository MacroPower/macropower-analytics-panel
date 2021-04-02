package collector_test

import (
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/MacroPower/macropower-analytics-panel/server/cacher"
	"github.com/MacroPower/macropower-analytics-panel/server/collector"
	"github.com/MacroPower/macropower-analytics-panel/server/payload"
	"github.com/MacroPower/macropower-analytics-panel/server/payloadtest"
	"github.com/go-kit/kit/log"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	payloadURL     = "/write"
	metricsURL     = "/metrics"
	logger         = log.NewNopLogger()
	cache          = cacher.NewCache()
	metricExporter = collector.NewExporter(cache, time.Duration(0), logger)
)

func init() {
	prometheus.MustRegister(metricExporter)
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

	handler := payload.NewHandler(cache, 10, true, true, logger)
	mux.Handle(payloadURL, handler)

	mux.Handle(metricsURL, promhttp.Handler())

	return mux
}

func TestSessionsTotal(t *testing.T) {
	testserver := httptest.NewServer(newMux())
	defer testserver.Close()

	request1 := payloadtest.GetPayload(t)
	request1.UUID = "test1"
	request1.Type = "start"
	payloadtest.SendPayload(t, testserver.URL+payloadURL, request1)

	request2 := payloadtest.GetPayload(t)
	request2.UUID = "test2"
	request2.Type = "start"
	payloadtest.SendPayload(t, testserver.URL+payloadURL, request2)

	time.Sleep(100 * time.Millisecond)

	m := getMetrics(t, testserver.URL)

	expectedSessionsTotal := `grafana_analytics_sessions_total{dashboard_name="New Dashboard 1234",dashboard_timezone="utc",dashboard_uid="b_1UbypGz",grafana_env="production",grafana_host="localhost:3000",user_locale="en-US",user_login="admin",user_name="admin",user_role="admin",user_theme="dark",user_timezone="browser"} 2`
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

	request1 := payloadtest.GetPayload(t)
	request1.UUID = "test1"
	request1.Type = "start"
	request1.Dashboard.UID = "test123"
	request1.Time = 1600000001
	request1.TimeOrigin = 1600000000
	payloadtest.SendPayload(t, testserver.URL+payloadURL, request1)
	time.Sleep(500 * time.Millisecond)

	request2 := payloadtest.GetPayload(t)
	request2.UUID = "test1"
	request2.Type = "end"
	request2.Dashboard.UID = "test123"
	request2.Time = 1600007200
	payloadtest.SendPayload(t, testserver.URL+payloadURL, request2)
	time.Sleep(500 * time.Millisecond)

	m := getMetrics(t, testserver.URL)

	expectedSessionsTotal := `grafana_analytics_sessions_total{dashboard_name="New Dashboard 1234",dashboard_timezone="utc",dashboard_uid="test123",grafana_env="production",grafana_host="localhost:3000",user_locale="en-US",user_login="admin",user_name="admin",user_role="admin",user_theme="dark",user_timezone="browser"} 1`
	if !strings.Contains(m, expectedSessionsTotal) {
		t.Errorf("Expected metrics to contain '%s', got:\n%s", expectedSessionsTotal, m)
	}

	expectedDurationSeconds := `grafana_analytics_sessions_duration_seconds{dashboard_name="New Dashboard 1234",dashboard_timezone="utc",dashboard_uid="test123",grafana_env="production",grafana_host="localhost:3000",user_locale="en-US",user_login="admin",user_name="admin",user_role="admin",user_theme="dark",user_timezone="browser"} 7200`
	if !strings.Contains(m, expectedDurationSeconds) {
		t.Errorf("Expected metrics to contain '%s', got:\n%s", expectedDurationSeconds, m)
	}

	cache.Flush()
}
