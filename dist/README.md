# macropower-analytics-panel

[![Downloads](https://img.shields.io/badge/dynamic/json?color=green&label=downloads&query=%24.downloads&url=https%3A%2F%2Fgrafana.com%2Fapi%2Fplugins%2Fmacropower-analytics-panel)](https://grafana.com/grafana/plugins/macropower-analytics-panel)
![Grafana Version](https://img.shields.io/badge/dynamic/json?color=orange&label=grafana%20version&query=%24.json.dependencies.grafanaVersion&url=https%3A%2F%2Fgrafana.com%2Fapi%2Fplugins%2Fmacropower-analytics-panel)
![Version](https://img.shields.io/badge/dynamic/json?color=blue&label=version&query=%24.version&url=https%3A%2F%2Fgrafana.com%2Fapi%2Fplugins%2Fmacropower-analytics-panel)
![Updated](https://img.shields.io/badge/dynamic/json?color=lightgray&label=updated&query=%24.json.info.updated&url=https%3A%2F%2Fgrafana.com%2Fapi%2Fplugins%2Fmacropower-analytics-panel)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=MacroPower_macropower-analytics-panel&metric=alert_status)](https://sonarcloud.io/dashboard?id=MacroPower_macropower-analytics-panel)

Grafana panel that forwards user data on mount &amp; unmount

## Features

Have you ever found yourself wanting to know who is using your dashboards, and how frequently they are being used?

Grafana has some built in support with Google Analytics, but nothing that will actually define **who** is using a dashboard. Missing this data is big problem, because the resulting statistics hardly answer any questions you might have. Questions like, "Who should I be catering to" or "What data should I be focusing on". Additionally, Google Analytics data can be quite inaccurate as you can't easily distinguish admins from end users.

This panel will forward data each time a dashboard is loaded or exited, including:

- Timestamps
- Username
- User roles
- Dashboard ID
- Instance info
- Session duration

You might want to consider this plugin until official support is implemented!

## Getting Started

You will need a server that accepts a JSON body identical to that provided by this plugin. This data will be sent to whatever URL you place in the plugin's settings.

### Telegraf

You can use Telegraf's `http_listener_v2` input to accept data from this plugin. An example configuration for this input can be found in the [example](https://github.com/MacroPower/macropower-analytics-panel/tree/master/example) directory. This example is by no means perfect, and you will need to customize it to fit your specific use case.

There are a few caveats with this approach:

- you can no longer gather session duration
- due to their structure, custom variables are not forwardable with "flatten" enabled.

### Custom

To fully utilize this plugin, you will need to design a custom service to accept payloads provided by the plugin, and store said payloads in a database of your choice.

I used Kotlin w/ Spring with a MySQL database, but again, you may use anything you want.

Your server should reply with `{location: <id>}` on record creation, where `id` is some unique value your backend associates to records. Your server will also need to accept the same JSON body at `/arbitrary-path/{id}`. This signals that the user's connection has ended. You can use this to write a new entry, or append your last entry with an END timestamp. Note that this will not be sent if the user closes the tab/browser. If you don't want this functionality, you can disable it in the plugin settings.

The panel itself will display the JSON body that will be sent (until it is hidden), so you should be able to write your models around that data.

## The Panel

This plugin works by using the session data provided to every panel in your dashboard. As such, you will need to ensure that analytics-panel is being loaded every time a dashboard you wish to monitor is being loaded. This means that you should place this panel in part of the dashboard that is guaranteed to be loaded by the user when they visit your dashboard. As of right now, **the only place that you absolutely _cannot_ place analytics-panel is inside a row**, as expanding and collapsing the row is essentially the same as loading and unloading the entire dashboard, from any panel's perspective.

While you cannot place the panel inside a row, you can take several steps to make the panel very difficult to notice, and this will not have any negative effects on the plugin's behavior.

- In Visualization, set Hidden to True.
- In General Settings, set Transparent to True.
- In General Settings, set Title/Description to nothing. Alternatively, you can set a Title/Description and use this panel as a title, separator, or footer.
- Save and make the panel as small as you want. I found that 0 height, 100% width works well.

## Default Settings

If you are planning on including this panel on many or all of your dashboards, you may want to consider changing the default settings for analytics-panel. This can save you time, since you will not need to input the same endpoint and/or toggle some setting every time you add a new panel.

You can edit defaults by changing the `dist/defaults.json` file. Note that changing this file will not change existing panels - defaults are _copied_ to the dashboard when the panel is added.

## Troubleshooting

If something is not working properly, the first thing you should do is look at your browser's console and network inspector. After opening the inspector, load a dashboard with an analytics-panel and take a look at the console, the request, and the response. In most cases, problems should be evident here.

In the event that you have many panels scattered across many dashboards, and suspect that some panels may be experiencing issues, you can sort your dashboards by "Errors Total - Most", or one of its variants. Note that errors are not thrown if json data is visible.

If you run into an issue you cannot solve, please post an [issue](https://github.com/MacroPower/macropower-analytics-panel/issues) and I will do my best to look into your inquiry.
