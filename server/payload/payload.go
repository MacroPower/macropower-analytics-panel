package payload

import (
	"sort"
	"time"

	"github.com/MacroPower/macropower-analytics-panel/server/cacher"
)

// Payload is the body expected on /write.
type Payload struct {
	UUID string `json:"uuid"`
	Type string `json:"type"`
	Host struct {
		Hostname  string `json:"hostname"`
		Port      string `json:"port"`
		Protocol  string `json:"protocol"`
		BuildInfo struct {
			Version string `json:"version"`
			Commit  string `json:"commit"`
			Env     string `json:"env"`
			Edition string `json:"edition"`
		} `json:"buildInfo"`
		LicenseInfo struct {
			HasLicense bool   `json:"hasLicense"`
			Expiry     int    `json:"expiry"`
			StateInfo  string `json:"stateInfo"`
		} `json:"licenseInfo"`
	} `json:"host"`
	Dashboard struct {
		Name string `json:"name"`
		UID  string `json:"uid"`
	} `json:"dashboard"`
	User struct {
		IsSignedIn                 bool   `json:"isSignedIn"`
		ID                         int    `json:"id"`
		Login                      string `json:"login"`
		Email                      string `json:"email"`
		Name                       string `json:"name"`
		LightTheme                 bool   `json:"lightTheme"`
		OrgCount                   int    `json:"orgCount"`
		OrgID                      int    `json:"orgId"`
		OrgName                    string `json:"orgName"`
		OrgRole                    string `json:"orgRole"`
		IsGrafanaAdmin             bool   `json:"isGrafanaAdmin"`
		Timezone                   string `json:"timezone"`
		Locale                     string `json:"locale"`
		HasEditPermissionInFolders bool   `json:"hasEditPermissionInFolders"`
	} `json:"user"`
	Variables []struct {
		Name   string        `json:"name"`
		Label  string        `json:"label"`
		Type   string        `json:"type"`
		Multi  bool          `json:"multi"`
		Values []interface{} `json:"values"`
	} `json:"variables"`
	TimeRange struct {
		From int `json:"from"`
		To   int `json:"to"`
		Raw  struct {
			From string `json:"from"`
			To   string `json:"to"`
		} `json:"raw"`
	} `json:"timeRange"`
	TimeZone   string `json:"timeZone"`
	TimeOrigin int    `json:"timeOrigin"`
	Time       int    `json:"time"`

	startTime      time.Time
	heartbeatTimes []time.Time
	endTime        time.Time
}

// addStart sets the payload StartTime and adds it to the cache.
func addStart(cache *cacher.Cacher, p Payload) {
	ts := time.Unix(int64(p.TimeOrigin), 0)
	p.startTime = ts
	cache.Add(p.UUID, p, cacher.Expiration)
}

// addHeartbeat sets the payload HeartbeatTime and sets it in the cache.
func addHeartbeat(cache *cacher.Cacher, p Payload) {
	ts := time.Unix(int64(p.Time), 0)

	cp, exists := cache.Get(p.UUID)
	if exists {
		p1 := cp.(Payload)
		p.heartbeatTimes = append(p1.heartbeatTimes, ts)
		p.startTime = p1.startTime
	} else {
		p.heartbeatTimes = []time.Time{ts}
		p.startTime = ts
	}

	cache.Set(p.UUID, p, cacher.Expiration)
}

// addEnd sets the payload EndTime and sets it in the cache.
func addEnd(cache *cacher.Cacher, p Payload) {
	ts := time.Unix(int64(p.Time), 0)
	p.endTime = ts

	cp, exists := cache.Get(p.UUID)
	if exists {
		p1 := cp.(Payload)
		p.heartbeatTimes = p1.heartbeatTimes
		p.startTime = p1.startTime
	} else {
		p.startTime = ts
	}

	cache.Set(p.UUID, p, cacher.Expiration)
}

// IsTimeSet returns a bool for each time element representing the set status.
func (p Payload) IsTimeSet() (start bool, heartbeat bool, end bool) {
	start = !p.startTime.IsZero()
	heartbeat = len(p.heartbeatTimes) > 0
	end = !p.endTime.IsZero()

	return start, heartbeat, end
}

// GetDuration returns the calculated duration of the session.
func (p Payload) GetDuration(max time.Duration) time.Duration {
	zeroDuration := time.Duration(0)

	if p.startTime.IsZero() {
		return zeroDuration
	}

	hbs := p.heartbeatTimes
	if len(hbs) > 0 {
		hbs = append(hbs, p.startTime)
		if !p.endTime.IsZero() {
			hbs = append(hbs, p.endTime)
		}
		sort.SliceStable(hbs, func(i, j int) bool {
			return hbs[i].Before(hbs[j])
		})

		duration := zeroDuration
		for i, hb := range hbs[1:] {
			durationDiff := hb.Sub(hbs[i])
			if max == zeroDuration || durationDiff < max {
				duration += durationDiff
			} else {
				duration += max
			}
		}
		return duration
	}

	return p.endTime.Sub(p.startTime)
}
