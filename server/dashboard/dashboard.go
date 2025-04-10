package dashboard

import (
	"encoding/json"
	"unicode/utf8"

	"github.com/MacroPower/macropower-analytics-panel/server/httpcli"
	"github.com/go-kit/kit/log"
	"github.com/go-kit/kit/log/level"
)

type Dashboard struct {
	Uid   string
	Data  map[string]interface{}
	Title string
}

type DashboardsResponse struct {
	Uid   string `json:"uid"`
	Title string `json:"title"`
}

type Response struct {
	Dashboard map[string]interface{} `json:"dashboard"`
}

type UpdateResponse struct {
	FolderUid string `json:"folderUid"`
	Id        uint64 `json:"id"`
	Slug      string `json:"slug"`
	Status    string `json:"status"`
	Uid       string `json:"uid"`
	Url       string `json:"url"`
	Version   uint64 `json:"version"`
}

func AddOrUpdateAnalyticsForAll(httpClient *httpcli.Client) {
	response, hasErrored := GetAll(httpClient)
	if hasErrored {
		return
	}

	var dashboardsToUpdate []Dashboard
	for _, dashboardEntry := range response {
		rawDashboardData := Get(httpClient, dashboardEntry.Uid)
		dashboardData := getTypedDashboardData(rawDashboardData, "dashboard")

		title, ok := dashboardData["title"]
		if ok {
			// if we have filter, but title is not matching the filter, skip this cycle
			if utf8.RuneCountInString(httpClient.Filter) > 0 && httpClient.Filter != title {
				continue
			}

			panels := getTypedPanelsData(dashboardData)
			hasAnalyticsPanel, analyticsPanelData := findAnalyticsPanel(panels, httpClient.Logger)

			updateRequired := false
			if hasAnalyticsPanel {
				if isPanelUrlUpdateRequired(*analyticsPanelData, httpClient.Logger, httpClient.AnalyticsUrl) {
					panelId := getPanelId(*analyticsPanelData)
					analyticsPanelData = createAnalyticsPanelData(panelId, httpClient.AnalyticsUrl)
					panels = overwriteExistingAnalyticsPanelData(panels, httpClient.Logger, *analyticsPanelData)
					updateRequired = true
				}
			} else {
				// As we create new panel, we need to assign larger id to new panel
				largestPanelId := getLargestPanelId(panels, httpClient.Logger)
				analyticsPanelData = createAnalyticsPanelData(largestPanelId+1, httpClient.AnalyticsUrl)
				panels = append([]interface{}{analyticsPanelData}, panels...)
				updateRequired = true
			}

			if updateRequired {
				dashboardData["panels"] = panels
				rawDashboardData.Data["dashboard"] = dashboardData

				addFolderUidOrId(rawDashboardData)

				dashboardsToUpdate = append(dashboardsToUpdate, Dashboard{
					Uid:   dashboardEntry.Uid,
					Data:  rawDashboardData.Data,
					Title: title.(string),
				})
			}
		}
	}

	updateAll(httpClient, dashboardsToUpdate)
}

func updateAll(httpClient *httpcli.Client, dashboards []Dashboard) {
	hasFilter := false

	if utf8.RuneCountInString(httpClient.Filter) > 0 {
		hasFilter = true
	}

	for _, dashboard := range dashboards {
		// Update only dashboard what was requested in filter
		if hasFilter && dashboard.Title != httpClient.Filter {
			continue
		}

		update(httpClient, dashboard)
	}
}

func update(httpClient *httpcli.Client, dashboard Dashboard) {
	dashboard.Data["overwrite"] = true
	dashboard.Data["message"] = "macropower-analytics-panel - Auto-add/update analytics panel"

	payload, err := json.Marshal(dashboard.Data)
	if err != nil {
		return
	}

	res, err := httpClient.Post("/api/dashboards/db", payload)
	if err != nil {
		level.Info(httpClient.Logger).Log(
			"status", "error",
			"message", "dashboard/update() - Failed to update dashboard",
			"error", err,
		)

		return
	}

	var responseAsStruct UpdateResponse
	err = json.Unmarshal(res, &responseAsStruct)
	if err != nil {
		level.Info(httpClient.Logger).Log(
			"status", "error",
			"message", "dashboard/update() - Failed to parse update response",
			"error", err,
		)

		return
	}

	if responseAsStruct.Status == "success" {
		level.Info(httpClient.Logger).Log(
			"status", "success",
			"message", "dashboard/update() - Added/Updated analytics for dashboard: "+dashboard.Title,
			"error", err,
		)
	}
}

func overwriteExistingAnalyticsPanelData(panels []interface{}, logger log.Logger, newAnalyticsData map[string]interface{}) []interface{} {
	for i, panel := range panels {
		panelMap, ok := panel.(map[string]interface{})
		if !ok {
			level.Info(logger).Log(
				"status", "error",
				"message", "dashboard/overwriteExistingAnalyticsPanelData() - Failed to type cast panel data",
			)

			continue
		}

		if isAnalyticsPanel(panelMap) {
			panels[i] = newAnalyticsData
		}
	}

	return panels
}

func getPanelId(panel map[string]interface{}) int {
	panelId, ok := panel["id"].(float64)
	if !ok {
		return 0
	}

	return int(panelId)
}

func getLargestPanelId(panels []interface{}, logger log.Logger) int {
	largestPanelId := 0

	for _, panel := range panels {
		panelMap, ok := panel.(map[string]interface{})
		if !ok {
			level.Info(logger).Log(
				"status", "error",
				"message", "dashboard/getLargestPanelId() - Failed to type cast panel data",
			)

			continue
		}

		// Go reports id as float, instead of int
		panelId := getPanelId(panelMap)
		panelIdAsInt := int(panelId)
		if largestPanelId < panelIdAsInt {
			largestPanelId = panelIdAsInt
		}
	}

	return largestPanelId
}

func findAnalyticsPanel(panels []interface{}, logger log.Logger) (bool, *map[string]interface{}) {
	hasAnalyticsPanel := false
	var analyticsPanelData *map[string]interface{}

	for _, panel := range panels {
		panelMap, ok := panel.(map[string]interface{})
		if !ok {
			level.Info(logger).Log(
				"status", "error",
				"message", "dashboard/findAnalyticsPanel() - Failed to type cast panel data",
			)

			continue
		}

		if isAnalyticsPanel(panelMap) {
			hasAnalyticsPanel = true
			analyticsPanelData = &panelMap
			break
		}
	}

	return hasAnalyticsPanel, analyticsPanelData
}

func getTypedDashboardData(rawDashboardData *Dashboard, key string) map[string]interface{} {
	dashboard, ok := rawDashboardData.Data[key]
	var emptyDashboardData map[string]interface{}
	if !ok {
		return emptyDashboardData
	}

	dashboardData, ok := dashboard.(map[string]interface{})
	if !ok {
		return emptyDashboardData
	}

	return dashboardData
}

func getTypedPanelsData(dashboardData map[string]interface{}) []interface{} {
	var emptyResponse []interface{}

	// Dashboards data might contain folders or other nonusable "dashboards"
	// All usable dashboards have minimum of empty panels array, even when dashboard is newly created without any panels
	// Due to this, we do not handle non "ok"
	panels, ok := dashboardData["panels"]
	if !ok {
		return emptyResponse
	}

	panelList, ok := panels.([]interface{})
	if !ok {
		return emptyResponse
	}

	return panelList
}

func isPanelUrlUpdateRequired(panelMap map[string]interface{}, logger log.Logger, analyticsUrl string) bool {
	panelOptions, ok := panelMap["options"].(map[string]interface{})
	if !ok {
		level.Info(logger).Log(
			"status", "error",
			"message", "dashboard/isPanelUrlUpdateRequired() - Failed to type cast panel options",
		)

		return false
	}

	panelAnalyticsOptions, ok := panelOptions["analyticsOptions"].(map[string]interface{})
	if !ok {
		level.Info(logger).Log(
			"status", "error",
			"message", "dashboard/isPanelUrlUpdateRequired() - Failed to type cast panel analytics options",
		)

		return false
	}

	panelServerUrl, ok := panelAnalyticsOptions["server"].(string)
	if !ok {
		level.Info(logger).Log(
			"status", "error",
			"message", "dashboard/isPanelUrlUpdateRequired() - Failed to type cast panel analytics server",
		)

		return false
	}

	return panelServerUrl != createAnalyticsUrl(analyticsUrl)
}

func addFolderUidOrId(dashboardData *Dashboard) {
	dashboardMetaData := getTypedDashboardData(dashboardData, "meta")
	folderUid := dashboardMetaData["folderUid"]
	folderId := dashboardMetaData["folderId"]

	if folderUid != nil {
		dashboardData.Data["folderUid"] = folderUid
	} else if folderId != nil {
		dashboardData.Data["folderId"] = folderId
	}
}

func createAnalyticsUrl(analyticsUrl string) string {
	return analyticsUrl + "/write"
}

func isAnalyticsPanel(panel map[string]interface{}) bool {
	panelType, ok := panel["type"]

	return ok && panelType == "macropower-analytics-panel"
}

func createAnalyticsPanelData(panelId int, analyticsUrl string) *map[string]interface{} {
	return &map[string]interface{}{
		"id":    panelId,
		"title": "Analytics",
		"type":  "macropower-analytics-panel",
		"gridPos": map[string]interface{}{
			"h": 0,
			"w": 0,
			"x": 0,
			"y": 0,
		},
		"options": map[string]interface{}{
			"analyticsOptions": map[string]interface{}{
				"dashboard":         "$__dashboard",
				"flatten":           false,
				"heartbeatAlways":   true,
				"heartbeatInterval": 30, // seconds
				"postEnd":           true,
				"postHeartbeat":     true,
				"postStart":         true,
				"server":            createAnalyticsUrl(analyticsUrl),
			},
		},
	}
}

func GetAll(httpClient *httpcli.Client) ([]DashboardsResponse, bool) {
	res, err := httpClient.Get("/api/search")
	if err != nil {
		level.Info(httpClient.Logger).Log(
			"status", "error",
			"message", "dashboard/GetAll() - Failed to get dashboards data",
			"error", err,
		)

		return nil, true
	}

	var response []DashboardsResponse
	err = json.Unmarshal(res, &response)
	if err != nil {
		level.Info(httpClient.Logger).Log(
			"status", "error",
			"message", "dashboard/GetAll() - Failed to parse JSON response",
			"error", err,
		)

		return nil, true
	}
	return response, false
}

func Get(httpClient *httpcli.Client, uid string) *Dashboard {
	res, err := httpClient.Get("/api/dashboards/uid/" + uid)
	if err != nil {
		level.Error(httpClient.Logger).Log(
			"status", "error",
			"message", "dashboard/Get() - api.Get failed",
			"error", err,
		)

		return nil
	}

	var dashboardData map[string]interface{}
	err = json.Unmarshal(res, &dashboardData)
	if err != nil {
		level.Info(httpClient.Logger).Log(
			"status", "error",
			"message", "dashboard/Get() - Failed to parse dashboardData response",
			"error", err,
		)

		return nil
	}

	return &Dashboard{
		Uid:  uid,
		Data: dashboardData,
	}
}
