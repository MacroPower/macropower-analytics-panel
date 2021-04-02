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

// NewCache creates a new in-memory Cache for payloads.
func NewCache() *Cacher {
	cacher := gocache.New(Expiration, Expiration)
	return cacher
}

// StartFlusher removes all items from the cache when maxCacheSize is exceeded.
func StartFlusher(cache *Cacher, maxCacheSize int, logger log.Logger) {
	for {
		if cache.ItemCount() > maxCacheSize {
			level.Info(logger).Log(
				"msg", "Flushing cache since it exceeded the size limit",
				"maxsize", maxCacheSize,
			)
			cache.Flush()
		}
		time.Sleep(time.Second)
	}
}
