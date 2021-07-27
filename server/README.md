# macropower-analytics-panel-server

[![Docker Pulls](https://img.shields.io/docker/pulls/macropower/analytics-panel-server)](https://hub.docker.com/r/macropower/analytics-panel-server)
[![Docker Image Size (latest by date)](https://img.shields.io/docker/image-size/macropower/analytics-panel-server?color=green)](https://hub.docker.com/r/macropower/analytics-panel-server)
[![Go Report Card](https://goreportcard.com/badge/github.com/MacroPower/macropower-analytics-panel)](https://goreportcard.com/report/github.com/MacroPower/macropower-analytics-panel)

A receiver for the [macropower-analytics-panel Grafana plugin](https://github.com/MacroPower/macropower-analytics-panel).

It can be used to expose data to systems supporting the OpenMetrics standard (e.g. Prometheus, InfluxDB 2.0) and/or your logging system of choice (e.g. Loki).

The service implements two endpoints:

- `/write`, the listener for plugin payloads.
- `/metrics`, the Prometheus metrics endpoint.

Logs are simply output to stdout. You can pick them up and ship them to your preferred logging system. For instance, if you use Loki, you can simply run this service as a container and use [Loki's Docker driver](https://grafana.com/docs/loki/latest/clients/docker-driver/).

## Installation

Use the docker image:

```shell
docker pull macropower/analytics-panel-server:latest
```

Or download a binary from the [releases page](https://github.com/MacroPower/macropower-analytics-panel/releases).

## Usage

```text
Usage: macropower_analytics_panel_server

A receiver for the macropower-analytics-panel Grafana plugin.

Flags:
  -h, --help                     Show context-sensitive help.
      --http-address=":8080"     Address to listen on for payloads and metrics
                                 ($HTTP_ADDRESS).
      --session-timeout=0        The maximum duration that may be added between
                                 heartbeats. 0 = auto ($SESSION_TIMEOUT).
      --max-cache-size=100000    The maximum number of sessions to store in the
                                 cache before resetting. 0 = unlimited
                                 ($MAX_CACHE_SIZE).
      --log-format="logfmt"      One of: [logfmt, json] ($LOG_FORMAT).
      --log-raw                  Outputs raw payloads as they are received
                                 ($LOG_RAW).
      --disable-user-metrics     Disables user labels in metrics
                                 ($DISABLE_USER_METRICS).
      --disable-session-log      Disables logging sessions to the console
                                 ($DISABLE_SESSION_LOG).
      --disable-variable-log     Disables logging variables to the console
                                 ($DISABLE_VARIABLE_LOG).
```

## Compatibility

| Server | Panel |
| ------ | ----- |
|        | 1.x.x |
| 0.0.1  | 2.0.x |

## Examples

### Metrics

```text
# HELP grafana_analytics_sessions_duration_seconds_total Duration of sessions.
# TYPE grafana_analytics_sessions_duration_seconds_total counter
grafana_analytics_sessions_duration_seconds_total{dashboard_name="Analytics Panel Example Dashboard",dashboard_timezone="browser",dashboard_uid="ZQZXRMXMk",grafana_env="production",grafana_host="localhost:3000",user_locale="en-US",user_login="admin",user_name="admin",user_role="admin",user_theme="dark",user_timezone="browser"} 6
# HELP grafana_analytics_sessions_total Number of sessions.
# TYPE grafana_analytics_sessions_total counter
grafana_analytics_sessions_total{dashboard_name="Analytics Panel Example Dashboard",dashboard_timezone="browser",dashboard_uid="ZQZXRMXMk",grafana_env="production",grafana_host="localhost:3000",user_locale="en-US",user_login="admin",user_name="admin",user_role="admin",user_theme="dark",user_timezone="browser"} 1
```

### Logs

```text
level=info msg="Received session data" uuid=e6cf6890-9469-49e6-927d-ea57c10f5a4f type=start has_focus=true host=http://localhost:3000 build="(commit=615c153b3a, edition=Open Source, env=production, version=7.5.4)" license="(state=, expiry=0, license=false)" dashboard_name="Analytics Panel Example Dashboard" dashboard_uid=ZQZXRMXMk dashboard_timezone=browser user_id=1 user_login=admin user_email=admin@localhost user_name=admin user_theme=dark user_role=admin user_locale=en-US user_timezone=browser time_from=1618782134 time_to=1618803734 time_from_raw=now-6h time_to_raw=now timeorigin=1618799093 time=1618803734 examplevar="(label=An Example Label, type=custom, multi=true, count=2, values=[world,bar])"
level=info msg="Received session data" uuid=e6cf6890-9469-49e6-927d-ea57c10f5a4f type=end has_focus=true host=http://localhost:3000 build="(commit=615c153b3a, edition=Open Source, env=production, version=7.5.4)" license="(state=, expiry=0, license=false)" dashboard_name="Analytics Panel Example Dashboard" dashboard_uid=ZQZXRMXMk dashboard_timezone=browser user_id=1 user_login=admin user_email=admin@localhost user_name=admin user_theme=dark user_role=admin user_locale=en-US user_timezone=browser time_from=1618782134 time_to=1618803734 time_from_raw=now-6h time_to_raw=now timeorigin=1618799093 time=1618803740 examplevar="(label=An Example Label, type=custom, multi=true, count=2, values=[world,bar])"
```

## Additional Details

### Prometheus Accuracy

Please be aware that if you use Prometheus, metrics will not be completely accurate. There are a few reasons for this.

It's not possible for us to initialize metrics. This means that the first time there is a unique session in a given cache lifetime, the metrics will be initialized with values. This breaks Prometheus counters because null -> 1 is considered to be an increase of 0. Subsequent sessions (e.g. 1 -> 2) will be returned correctly.

Prometheus will attempt to extrapolate correct rates, which does not work well at all for slow-moving counters. It will be common for metrics to be a shown as lot higher than they actually are. There's an [open proposal](https://github.com/prometheus/prometheus/issues/3806) to fix this, but it looks doubtful a solution will be implemented. You can use recording rules to fix this somewhat (see [this issue](https://github.com/prometheus/prometheus/issues/3746)), but results can still be incorrect if you drop a scrape, reset metrics, etc.

If you care about this, these problems have been solved in other TSDBs. For example, InfluxDB, VictoriaMetrics, and Timescale among others.

### Session Timeout

Session timeout is a useful feature that can prevent sessions from being represented as continuous, even if the user is inactive. It essentially limits the maximum calculated time between two heartbeats. For instance, consider the following sequence of events:

-> User loads Dashboard
-> Uses dashboard for 15 minutes
-> Navigates to a different tab
-> Does other work for 4 hours
-> Navigates back to the dashboard

With no session timeout, this session will be represented as being 4 hours and 15 minutes long. However, if we were to set, for example, `session-timeout=1h`, this session will be represented as being 1 hour 15 minutes long, since the inferred duration where no heartbeats were sent is being capped at 1 hour.

By default, this value is automatically set using the Heartbeat Interval from the payload.

### Max Cache Size

Max cache size is a compromise that prevents needing to run a dedicated database for session data. Instead, an object is stored in-memory for each session uuid. To prevent the service from continually growing until it crashes, the memory must be routinely reset. You might ask why we can't just expire sessions, and that is because we expose [Counters](https://prometheus.io/docs/concepts/metric_types/#counter) which allow you to [rate()](https://prometheus.io/docs/prometheus/latest/querying/functions/#rate) over your data. This allows you to create continuous graphs that represent all data, even if scrapes are missed or the service is restarted.

If you happen to reset memory or restart when session data exists, but has not yet been scraped, this session data will be lost. For existing sessions that are "in progress", the maximum accuracy loss will never be greater than the session timeout duration.

Generally, you should consider the amount of traffic you're generating, and try to ensure that sessions remain cached for at least 24 hours (ideally longer), while also keeping in mind that more sessions in memory corresponds to a higher memory footprint.
