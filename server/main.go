package main

import (
	"net/http"
	"os"

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
)

func main() {
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
		}
	}()

	handler := NewPayloadHandler(logger, c)
	mux.Handle("/write", handler)

	exporter := version.NewCollector("grafana_analytics")
	metricExporter := NewExporter(logger)
	prometheus.MustRegister(exporter, metricExporter)
	mux.Handle("/metrics", promhttp.Handler())

	err := http.ListenAndServe(":8080", mux)
	panic(err)
}
