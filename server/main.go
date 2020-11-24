package main

import (
	"net/http"
	"os"
	"time"

	"github.com/alecthomas/kong"
	"github.com/go-kit/kit/log"
	"github.com/go-kit/kit/log/level"
	gocache "github.com/patrickmn/go-cache"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/prometheus/common/version"
)

var (
	// Cache is an in-memory cache for payloads.
	Cache = gocache.New(gocache.NoExpiration, gocache.NoExpiration)

	// Expiration is the expiration of items in Cache.
	Expiration = gocache.NoExpiration

	cli struct {
		HTTPAddress        string        `help:"Address to listen on for payloads and metrics." default:":8080"`
		SessionTimeout     time.Duration `help:"The maximum duration that may be added between heartbeats. 0 = unlimited." type:"time.Duration" env:"SESSION_TIMEOUT" default:"0"`
		DisableSessionLog  bool          `help:"Disables logging sessions to the console."`
		DisableVariableLog bool          `help:"Disables logging variables to the console."`
	}
)

func main() {
	ctx := kong.Parse(
		&cli,
		kong.Name("grafana_analytics_server"),
		kong.Description("A receiver for the macropower-analytics-panel Grafana plugin."),
	)

	logger := log.NewLogfmtLogger(log.NewSyncWriter(os.Stdout))
	level.Info(logger).Log(
		"msg", "Starting server for macropower-analytics-panel",
		"version", version.Info(),
	)
	level.Info(logger).Log(
		"msg", "Build context",
		"context", version.BuildContext(),
	)

	mux := http.NewServeMux()

	c := make(chan Payload)
	go func() {
		for p := range c {
			ProcessPayload(logger, p)
			if !cli.DisableSessionLog {
				LogPayload(logger, p, !cli.DisableVariableLog)
			}
		}
	}()

	handler := NewPayloadHandler(logger, c)
	mux.Handle("/write", handler)

	exporter := version.NewCollector("grafana_analytics")
	metricExporter := NewExporter(logger, cli.SessionTimeout)
	prometheus.MustRegister(exporter, metricExporter)
	mux.Handle("/metrics", promhttp.Handler())

	err := http.ListenAndServe(cli.HTTPAddress, mux)
	ctx.FatalIfErrorf(err)
}
