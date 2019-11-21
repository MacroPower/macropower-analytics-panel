# macropower-analytics-panel
Grafana panel that forwards user data on mount &amp; unmount

## Features
Have you ever found yourself wanting to know who is using your dashboards, and how frequently they are being used?

Grafana has some built in support with Google Analytics, but nothing that will actually define **who** is using a dashboard. Missing this data is big problem, because the resulting statistics hardly answer any questsions you might have. Questions like, "Who should I be catering to" or "What data should I be focusing on". Additionally, Google Analytics data can be quite inaccurate as you can't easily distinguish admins from end users.

This panel will forward data each time a panel is loaded or exited, including:

- Timestamps
- Username
- Dashboard ID
- Instance info

You might want to consider this plugin until official support is implemented!

## Getting Started
You will need a server that accepts a JSON body identical to that provided by this plugin. This data will be sent to whatever URL you place in the plugin's settings.

I used Kotlin w/ Spring, but you may use anything you want.

Your server should reply with `{location: <id>}` on record creation, where `id` is some unique value your backend associates to records. Your server will also need to accept the same JSON body at `youraddress/yourpath/{id}`. This signals that the user's connection has ended. You can use this to write a new entry, or append your last entry with an END timestamp. Note that this will not be sent if the user closes the tab/browser. If you don't want this functionality, you can disable it on the Visualization page.

The panel itself will display the JSON body that will be sent (until it is hidden), so you should be able to write your models around that data.

The other settings, "Unique ID" and "Description" are used to distinguish one dashboard from another. They will be auto populated when you load the Visualization page. Feel free to change them.

## Hiding the panel
- In Visualization, set Hidden to True.
- In General Settings, set Transparent to True.
- In General Settings, set Title/Description to nothing.
- Save and make the panel as small as you want. I found that 0 height, 100% width works well.