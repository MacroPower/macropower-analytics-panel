package cacher

import (
	"time"

	"github.com/go-kit/kit/log"
	"github.com/go-kit/kit/log/level"
	gocache "github.com/patrickmn/go-cache"
)

const (
	// Expiration is the expiration of items in Cache.
	Expiration = gocache.NoExpiration
)

// Cacher is a cache for payloads.
type Cacher = gocache.Cache

// NewCacher creates a new in-memory Cacher for payloads.
func NewCacher(maxCacheSize int, logger log.Logger) *Cacher {
	cacher := gocache.New(Expiration, Expiration)
	startFlusher(cacher, maxCacheSize, logger)
	return cacher
}

// startFlusher removes all items from the cache when maxCacheSize is exceeded.
func startFlusher(cacher *Cacher, maxCacheSize int, logger log.Logger) {
	go func() {
		if maxCacheSize != 0 {
			for {
				if cacher.ItemCount() > maxCacheSize {
					level.Info(logger).Log(
						"msg", "Flushing cache since it exceeded the size limit",
						"maxsize", maxCacheSize,
					)
					cacher.Flush()
				}
				time.Sleep(time.Second)
			}
		}
	}()
}
