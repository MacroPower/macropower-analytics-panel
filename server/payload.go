package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"time"

	"github.com/go-kit/kit/log"
	"github.com/go-kit/kit/log/level"
)

// PayloadHandler is the handler for incoming payloads.
type PayloadHandler struct {
	logger log.Logger
	pc     chan Payload
}

// NewPayloadHandler creates a new PayloadHandler.
func NewPayloadHandler(logger log.Logger, pc chan Payload) *PayloadHandler {
	return &PayloadHandler{
		logger: logger,
		pc:     pc,
	}
}

func (h *PayloadHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	p := Payload{}

	err := json.NewDecoder(r.Body).Decode(&p)
	if err != nil {
		http.Error(w, "", http.StatusBadRequest)
		return
	}

	h.pc <- p

	w.WriteHeader(http.StatusCreated)
	fmt.Fprint(w, "")
}

// ProcessPayload is a receiver for Payloads.
func ProcessPayload(logger log.Logger, p Payload) {
	h := p.Host
	bi := h.BuildInfo
	li := h.LicenseInfo
	u := p.User
	tr := p.TimeRange

	var theme string
	if u.LightTheme {
		theme = "light"
	} else {
		theme = "dark"
	}

	var role string
	if u.IsGrafanaAdmin {
		role = "admin"
	} else if u.HasEditPermissionInFolders {
		role = "editor"
	} else {
		role = "user"
	}

	labels := []interface{}{
		"msg", "Received session data",
		"uuid", p.UUID,
		"type", p.Type,
		"host", fmt.Sprintf("%s//%s:%s", h.Protocol, h.Hostname, h.Port),
		"build", fmt.Sprintf("(commit=%s, edition=%s, env=%s, version=%s)", bi.Commit, bi.Edition, bi.Env, bi.Version),
		"license", fmt.Sprintf("(state=%s, expiry=%d, license=%t)", li.StateInfo, li.Expiry, li.HasLicense),
		"dashboard_name", p.Dashboard.Name,
		"dashboard_uid", p.Dashboard.UID,
		"dashboard_timezone", p.TimeZone,
		"user_id", u.ID,
		"user_login", u.Login,
		"user_email", u.Email,
		"user_name", u.Name,
		"user_theme", theme,
		"user_role", role,
		"user_locale", u.Locale,
		"user_timezone", u.Timezone,
		"time_from", tr.From,
		"time_to", tr.To,
		"time_from_raw", tr.Raw.From,
		"time_to_raw", tr.Raw.To,
		"timeorigin", p.TimeOrigin,
		"time", p.Time,
	}

	for _, v := range p.Variables {
		d := fmt.Sprintf("(label=%s, type=%s, multi=%t, count=%d)", v.Label, v.Type, v.Multi, len(v.Values))
		labels = append(labels, v.Name, d)
	}

	_ = level.Info(logger).Log(labels...)

	switch p.Type {
	case "start":
		AddStart(p)
	case "heartbeat":
		AddHeartbeat(p)
	case "end":
		AddEnd(p)
	default:
		AddHeartbeat(p)
		_ = level.Warn(logger).Log(
			"msg", "Session has invalid type, defaulted to heartbeat",
			"uuid", p.UUID,
			"type", p.Type,
		)
	}
}

// AddStart sets the payload StartTime and adds it to the cache.
func AddStart(p Payload) {
	ts := time.Unix(int64(p.TimeOrigin), 0)
	p.startTime = ts
	Cache.Add(p.UUID, p, Expiration)
}

// AddHeartbeat sets the payload HeartbeatTime and sets it in the cache.
func AddHeartbeat(p Payload) {
	ts := time.Unix(int64(p.Time), 0)

	cp, exists := Cache.Get(p.UUID)
	if exists {
		p1 := cp.(Payload)
		p.heartbeatTimes = append(p1.heartbeatTimes, ts)
		p.startTime = p1.startTime
	} else {
		p.heartbeatTimes = []time.Time{ts}
		p.startTime = ts
	}

	Cache.Set(p.UUID, p, Expiration)
}

// AddEnd sets the payload EndTime and sets it in the cache.
func AddEnd(p Payload) {
	ts := time.Unix(int64(p.Time), 0)
	p.endTime = ts

	cp, exists := Cache.Get(p.UUID)
	if exists {
		p1 := cp.(Payload)
		p.heartbeatTimes = p1.heartbeatTimes
		p.startTime = p1.startTime
	} else {
		p.startTime = ts
	}

	Cache.Set(p.UUID, p, Expiration)
}

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
