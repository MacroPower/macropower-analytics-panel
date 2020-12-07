package main

import (
	"net/http"
	"os"
	"time"

	"github.com/MacroPower/macropower-analytics-panel/server/cacher"
	"github.com/MacroPower/macropower-analytics-panel/server/collector"
	"github.com/MacroPower/macropower-analytics-panel/server/payload"
	"github.com/alecthomas/kong"
	"github.com/go-kit/kit/log"
	"github.com/go-kit/kit/log/level"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/prometheus/common/version"
)

var (
	cli struct {
		HTTPAddress        string        `help:"Address to listen on for payloads and metrics." default:":8080"`
		SessionTimeout     time.Duration `help:"The maximum duration that may be added between heartbeats. 0 = unlimited." type:"time.Duration" env:"SESSION_TIMEOUT" default:"0"`
		MaxCacheSize       int           `help:"The maximum number of sessions to store in the cache before resetting. 0 = unlimited." default:"1000"`
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

	cache := cacher.NewCache(cli.MaxCacheSize, logger)

	mux := http.NewServeMux()

	handler := payload.NewHandler(cache, !cli.DisableSessionLog, !cli.DisableVariableLog, logger)
	mux.Handle("/write", handler)

	exporter := version.NewCollector("grafana_analytics")
	metricExporter := collector.NewExporter(cache, cli.SessionTimeout, logger)
	prometheus.MustRegister(exporter, metricExporter)
	mux.Handle("/metrics", promhttp.Handler())

	err := http.ListenAndServe(cli.HTTPAddress, mux)
	ctx.FatalIfErrorf(err)
}
