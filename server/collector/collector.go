package collector

import (
	"sync"
	"time"

	"github.com/MacroPower/macropower-analytics-panel/server/cacher"
	"github.com/MacroPower/macropower-analytics-panel/server/payload"
	"github.com/go-kit/kit/log"
	"github.com/go-kit/kit/log/level"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	namespace = "grafana"
	subsystem = "analytics"
)

// Exporter is an exporter for metrics derrived from payloads in the cache.
type Exporter struct {
	SessionCount    *prometheus.CounterVec
	SessionDuration *prometheus.CounterVec

	mu            sync.Mutex
	up            prometheus.Gauge
	totalScrapes  prometheus.Counter
	queryFailures prometheus.Counter

	cache   *cacher.Cacher
	timeout time.Duration
	logger  log.Logger
}

// NewExporter creates an Exporter.
func NewExporter(cache *cacher.Cacher, timeout time.Duration, logger log.Logger) *Exporter {
	labels := []string{
		"grafana_host",
		"grafana_env",
		"dashboard_name",
		"dashboard_uid",
		"dashboard_timezone",
		"user_login",
		"user_name",
		"user_theme",
		"user_timezone",
		"user_locale",
		"user_role",
	}

	return &Exporter{
		SessionCount: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "sessions_total",
				Help:      "Number of sessions.",
			},
			labels,
		),
		SessionDuration: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "sessions_duration_seconds_total",
				Help:      "Duration of sessions.",
			},
			labels,
		),
		up: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "up",
			Help:      "Was the last scrape successful.",
		}),
		totalScrapes: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "exporter_scrapes_total",
			Help:      "Number of scrapes.",
		}),
		queryFailures: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "exporter_query_failures_total",
			Help:      "Number of errors.",
		}),
		cache:   cache,
		timeout: timeout,
		logger:  logger,
	}
}

// Describe describes all metrics with constant descriptions.
func (e *Exporter) Describe(ch chan<- *prometheus.Desc) {
	ch <- e.up.Desc()
	ch <- e.totalScrapes.Desc()
	ch <- e.queryFailures.Desc()
}

// Collect sets and collects all metrics.
func (e *Exporter) Collect(ch chan<- prometheus.Metric) {
	e.mu.Lock() // To protect metrics from concurrent collects.
	defer e.mu.Unlock()

	e.SessionCount.Reset()
	e.SessionDuration.Reset()

	err := e.scrape(ch)
	up := float64(1)
	if err != nil {
		up = float64(0)
		e.queryFailures.Inc()
		level.Error(e.logger).Log("msg", "Collection failed", "err", err)
	}
	e.up.Set(up)
	e.totalScrapes.Inc()

	e.SessionCount.Collect(ch)
	e.SessionDuration.Collect(ch)

	ch <- e.up
	ch <- e.totalScrapes
	ch <- e.queryFailures
}

func (e *Exporter) scrape(ch chan<- prometheus.Metric) error {
	cacheItems := e.cache.Items()
	for _, c := range cacheItems {
		p := c.Object.(payload.Payload)

		var theme string
		if p.User.LightTheme {
			theme = "light"
		} else {
			theme = "dark"
		}

		var role string
		if p.User.IsGrafanaAdmin {
			role = "admin"
		} else if p.User.HasEditPermissionInFolders {
			role = "editor"
		} else {
			role = "user"
		}

		labels := []string{
			p.Host.Hostname + ":" + p.Host.Port,
			p.Host.BuildInfo.Env,
			p.Dashboard.Name,
			p.Dashboard.UID,
			p.TimeZone,
			p.User.Login,
			p.User.Name,
			theme,
			p.User.Timezone,
			p.User.Locale,
			role,
		}

		sessionCount, err := e.SessionCount.GetMetricWithLabelValues(labels...)
		if err != nil {
			return err
		}
		sessionCount.Inc()

		startSet, hbSet, endSet := p.IsTimeSet()
		if !startSet {
			level.Error(e.logger).Log("msg", "Start time is not set for session", "uuid", p.UUID)
		} else if endSet || hbSet {
			sessionDuration, err := e.SessionDuration.GetMetricWithLabelValues(labels...)
			if err != nil {
				return err
			}

			sessionDuration.Add(p.GetDuration(e.timeout).Seconds())
		}
	}

	return nil
}
