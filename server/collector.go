package main

import (
	"strconv"
	"sync"
	"time"

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

	Mutex         sync.Mutex
	Up            prometheus.Gauge
	TotalScrapes  prometheus.Counter
	QueryFailures prometheus.Counter
	Logger        log.Logger
}

// NewExporter creates an Exporter.
func NewExporter(logger log.Logger) *Exporter {
	return &Exporter{
		SessionCount: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "sessions_total",
				Help:      "Was the last scrape successful.",
			}, []string{
				"grafana_host",
				"grafana_env",
				"grafana_edition",
				"grafana_licensed",
				"dashboard_name",
				"dashboard_uid",
				"user_login",
				"user_email",
				"user_name",
				"light_theme",
				"admin",
				"editor",
				"timezone",
				"locale",
				"dashboard_timezone",
			}),
		SessionDuration: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "sessions_duration",
				Help:      "Was the last scrape successful.",
			},
			[]string{
				"grafana_host",
				"grafana_env",
				"grafana_edition",
				"grafana_licensed",
				"dashboard_name",
				"dashboard_uid",
				"user_login",
				"user_email",
				"user_name",
				"light_theme",
				"admin",
				"editor",
				"timezone",
				"locale",
				"dashboard_timezone",
			}),
		Up: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "up",
			Help:      "Was the last scrape successful.",
		}),
		TotalScrapes: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "exporter_scrapes_total",
			Help:      "Number of scrapes.",
		}),
		QueryFailures: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "exporter_query_failures_total",
			Help:      "Number of errors.",
		}),
		Logger: logger,
	}
}

// Describe describes all metrics with constant descriptions.
func (e *Exporter) Describe(ch chan<- *prometheus.Desc) {
	ch <- e.Up.Desc()
	ch <- e.TotalScrapes.Desc()
	ch <- e.QueryFailures.Desc()
}

// Collect sets and collects all metrics.
func (e *Exporter) Collect(ch chan<- prometheus.Metric) {
	e.Mutex.Lock() // To protect metrics from concurrent collects.
	defer e.Mutex.Unlock()

	e.SessionCount.Reset()
	e.SessionDuration.Reset()

	err := e.scrape(ch)
	up := float64(1)
	if err != nil {
		up = float64(0)
		e.QueryFailures.Inc()
		level.Error(e.Logger).Log("msg", "Collection failed", "err", err)
	}
	e.Up.Set(up)

	e.SessionCount.Collect(ch)
	e.SessionDuration.Collect(ch)

	ch <- e.Up
	ch <- e.TotalScrapes
	ch <- e.QueryFailures
}

func (e *Exporter) scrape(ch chan<- prometheus.Metric) error {
	cacheItems := Cache.Items()
	for _, c := range cacheItems {
		p := c.Object.(Payload)

		labels := []string{
			p.Host.Hostname + ":" + p.Host.Port,
			p.Host.BuildInfo.Env,
			p.Host.BuildInfo.Edition,
			strconv.FormatBool(p.Host.LicenseInfo.HasLicense),
			p.Dashboard.Name,
			p.Dashboard.UID,
			p.User.Login,
			p.User.Email,
			p.User.Name,
			strconv.FormatBool(p.User.LightTheme),
			strconv.FormatBool(p.User.IsGrafanaAdmin),
			strconv.FormatBool(p.User.HasEditPermissionInFolders),
			p.User.Timezone,
			p.User.Locale,
			p.TimeZone,
		}

		sessionCount, err := e.SessionCount.GetMetricWithLabelValues(labels...)
		if err != nil {
			return err
		}
		sessionCount.Inc()

		hbSet := len(p.heartbeatTimes) > 0
		endSet := !p.endTime.IsZero()

		if p.startTime.IsZero() {
			level.Error(e.Logger).Log("msg", "Start time is not set for session", "uuid", p.UUID)
		} else if endSet || hbSet {
			sessionDuration, err := e.SessionDuration.GetMetricWithLabelValues(labels...)
			if err != nil {
				return err
			}

			sessionDuration.Add(p.GetDuration(time.Duration(0)).Seconds())
		}
	}

	return nil
}
