package cacher_test

import (
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/MacroPower/macropower-analytics-panel/server/cacher"
	"github.com/go-kit/kit/log"
)

var (
	logger = log.NewLogfmtLogger(log.NewSyncWriter(os.Stdout))
)

func TestFlushOnMaxSizeExceeded(t *testing.T) {
	maxSize := 10
	cache := cacher.NewCache(maxSize, logger)

	for i := 0; i < maxSize; i++ {
		cache.Add(fmt.Sprint(i), nil, -1)
	}
	time.Sleep(100 * time.Millisecond)
	cacheItemCountBeforeFlush := cache.ItemCount()
	if cacheItemCountBeforeFlush != maxSize {
		t.Errorf("Expected '%d' items, got '%d'", maxSize, cacheItemCountBeforeFlush)
	}

	cache.Add("hello", nil, -1)
	time.Sleep(1100 * time.Millisecond)
	cacheItemCountAfterFlush := cache.ItemCount()
	if cacheItemCountAfterFlush != 0 {
		t.Errorf("Expected '%d' items, got '%d'", 0, cacheItemCountAfterFlush)
	}
}
