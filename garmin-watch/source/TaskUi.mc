import Toybox.Activity;
import Toybox.Application;
import Toybox.Attention;
import Toybox.Communications;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.SensorHistory;
import Toybox.Time;
import Toybox.Time.Gregorian;
import Toybox.WatchUi;

//! Colours from the Goal Tracker web app (same as the watch face)
const UI_GOLD  = 0xD4A853;
const UI_NAVY  = 0x1B2E45;
const UI_MUTED = 0x6A7F96;
const UI_TEXT  = 0xEEE8DF;

const SNOOZE_MINUTES = 15;

module TaskUi {
    var controller as TaskController or Null = null;

    function initialView() as [WatchUi.Views, WatchUi.InputDelegates] {
        var c = new TaskController();
        controller = c;
        var focus = c.takeWakeFocus();
        var menu = c.buildMenu(focus);
        c.start();
        return [menu, new TaskMenuDelegate(c)];
    }

    //! New background data arrived while the app is open
    function onNewData() as Void {
        var c = controller;
        if (c != null) {
            c.rebuild();
            c.alertNewDue();
            c.flush();
        }
    }

    function vibrate(long as Boolean) as Void {
        if (Attention has :vibrate) {
            var p = long
                ? [new Attention.VibeProfile(80, 400), new Attention.VibeProfile(0, 200), new Attention.VibeProfile(80, 400)]
                : [new Attention.VibeProfile(50, 120)];
            Attention.vibrate(p as Array<Attention.VibeProfile>);
        }
    }

    //! Shorten to fit a menu title / glance line
    function clip(s as String, max as Number) as String {
        if (s.length() <= max) {
            return s;
        }
        var head = s.substring(0, max - 1);
        return (head != null ? head : s) + "...";
    }

    function timeOf(epoch as Number) as String {
        var info = Gregorian.info(new Time.Moment(epoch), Time.FORMAT_SHORT);
        return info.hour.format("%02d") + ":" + info.min.format("%02d");
    }
}

//! Owns the main task menu and all web requests from the foreground app.
//! Actions are applied locally at once and queued in Storage ("queue"), then
//! sent one by one; anything that fails (phone away) is retried on the next
//! sync, so nothing is lost when the phone is out of range.
class TaskController {
    private var _menu as WatchUi.Menu2 or Null = null;
    private var _busy as Boolean = false;
    private var _status as String = "";

    function initialize() {
    }

    //! Called once the initial view exists: send queued actions, then fetch
    function start() as Void {
        if (queue().size() > 0) {
            flush();
        } else {
            refresh();
        }
    }

    // ---------------------------------------------------------------- menu

    function buildMenu(focus as Number) as WatchUi.Menu2 {
        var menu = new WatchUi.Menu2({ :title => menuTitle(), :focus => focus });
        _menu = menu;
        addItems(menu);
        return menu;
    }

    //! Rebuild the main menu in place (it may not be on top)
    function rebuild() as Void {
        var menu = _menu;
        if (menu == null) {
            return;
        }
        var guard = 0;
        while (menu.getItem(0) != null && guard < 40) {
            menu.deleteItem(0);
            guard += 1;
        }
        menu.setTitle(menuTitle());
        addItems(menu);
        WatchUi.requestUpdate();
    }

    private function menuTitle() as String {
        var r = TaskStore.readiness();
        return r != null ? "Today · " + r.format("%d") : "Today";
    }

    private function addItems(menu as WatchUi.Menu2) as Void {
        var tasks = TaskStore.tasks();
        if (tasks.size() == 0) {
            menu.addItem(new WatchUi.MenuItem("No routine tasks", "Tap to sync", :none, null));
        }
        for (var i = 0; i < tasks.size(); i += 1) {
            var row = tasks[i];
            if (!(row instanceof Array) || !(row[TaskStore.ID] instanceof String)) {
                continue;
            }
            var id = row[TaskStore.ID] as String;
            var label = row[TaskStore.TITLE] instanceof String ? row[TaskStore.TITLE] as String : "Task";
            var status = row[TaskStore.STATUS] instanceof String ? row[TaskStore.STATUS] as String : "pending";
            var due = TaskStore.isDue(id);
            menu.addItem(new WatchUi.IconMenuItem(label, subLabel(row, due), id, new StatusIcon(status, due), null));
        }
        menu.addItem(new WatchUi.MenuItem("Quick capture", "Idea, energy, break...", :capture, null));
        menu.addItem(new WatchUi.MenuItem("Sync now", syncLabel(), :refresh, null));
    }

    private function subLabel(row as Array, due as Boolean) as String {
        var status = row[TaskStore.STATUS];
        var at = row[TaskStore.DUE] instanceof String ? row[TaskStore.DUE] as String : "Anytime";
        if ("done".equals(status)) {
            return "Done · " + at;
        }
        if ("skipped".equals(status)) {
            return "Skipped · " + at;
        }
        if ("snoozed".equals(status) && row[TaskStore.SNOOZED] instanceof Number) {
            return "Snoozed to " + TaskUi.timeOf(row[TaskStore.SNOOZED] as Number);
        }
        return due ? "Due now · " + at : at;
    }

    private function syncLabel() as String {
        if (!_status.equals("")) {
            return _status;
        }
        var q = queue().size();
        if (q > 0) {
            return q.format("%d") + " waiting for phone";
        }
        var t = Application.Storage.getValue("tasksAt");
        if (t instanceof Number) {
            return "Updated " + ((Time.now().value() - t) / 60).format("%d") + " min ago";
        }
        return "Not synced yet";
    }

    private function setStatus(s as String) as Void {
        _status = s;
        rebuild();
    }

    //! Focus index for the task that woke the app, and buzz once for it
    function takeWakeFocus() as Number {
        var id = Application.Storage.getValue("wakeTask");
        var at = Application.Storage.getValue("wakeAt");
        Application.Storage.deleteValue("wakeTask");
        if (!(id instanceof String) || !(at instanceof Number) || Time.now().value() - at > 15 * 60) {
            return 0;
        }
        TaskUi.vibrate(true);
        var tasks = TaskStore.tasks();
        for (var i = 0; i < tasks.size(); i += 1) {
            var row = tasks[i];
            if (row instanceof Array && id.equals(row[TaskStore.ID])) {
                return i;
            }
        }
        return 0;
    }

    //! The app is open: buzz for tasks that became due since the last alert
    function alertNewDue() as Void {
        var prev = Application.Storage.getValue("woken");
        var prevIds = prev instanceof String ? prev : "";
        var due = TaskStore.dueIds();
        var ids = "";
        var fresh = false;
        for (var i = 0; i < due.size(); i += 1) {
            var id = due[i];
            if (id instanceof String) {
                ids += id + ",";
                if (prevIds.find(id) == null && TaskStore.isDue(id)) {
                    fresh = true;
                }
            }
        }
        Application.Storage.setValue("woken", ids);
        if (fresh) {
            TaskUi.vibrate(true);
        }
    }

    // ------------------------------------------------------------- actions

    //! action: "done" | "snooze" | "skip"
    function act(id as String, action as String, reason as String or Null) as Void {
        var params = { "action" => action, "ts" => Time.now().value() } as Dictionary<String, Application.PropertyValueType>;
        if (action.equals("snooze")) {
            params.put("minutes", SNOOZE_MINUTES);
            TaskStore.setStatus(id, "snoozed", Time.now().value() + SNOOZE_MINUTES * 60);
        } else if (action.equals("skip")) {
            params.put("reason", reason != null ? reason : "skipped");
            TaskStore.setStatus(id, "skipped", null);
        } else {
            TaskStore.setStatus(id, "done", null);
        }
        enqueue("/tasks/" + id + "/action", params);
        TaskUi.vibrate(false);
        rebuild();
        flush();
    }

    //! kind: "idea" | "low_energy" | "distracted" | "break" | "win"
    function capture(kind as String) as Void {
        var params = { "kind" => kind, "ts" => Time.now().value() } as Dictionary<String, Application.PropertyValueType>;
        var hr = Activity.getActivityInfo().currentHeartRate;
        if (hr != null) {
            params.put("hr", hr);
        }
        var stress = latest(:stress);
        if (stress != null) {
            params.put("stress", stress);
        }
        var bb = latest(:bodyBattery);
        if (bb != null) {
            params.put("bodyBattery", bb);
        }
        enqueue("/capture", params);
        TaskUi.vibrate(false);
        if (WatchUi has :showToast) {
            WatchUi.showToast("Logged", null);
        }
        flush();
    }

    private function latest(kind as Symbol) as Number or Null {
        if (!(Toybox has :SensorHistory)) {
            return null;
        }
        var it = null;
        if (kind == :stress && SensorHistory has :getStressHistory) {
            it = SensorHistory.getStressHistory({ :period => 1 });
        } else if (kind == :bodyBattery && SensorHistory has :getBodyBatteryHistory) {
            it = SensorHistory.getBodyBatteryHistory({ :period => 1 });
        }
        var s = it != null ? it.next() : null;
        if (s != null && s.data != null) {
            return (s.data as Numeric).toNumber();
        }
        return null;
    }

    // ------------------------------------------------------------- network

    private function queue() as Array {
        var q = Application.Storage.getValue("queue");
        return q instanceof Array ? q : [];
    }

    private function enqueue(path as String, params as Dictionary<String, Application.PropertyValueType>) as Void {
        var q = queue();
        q.add([path, params]);
        while (q.size() > 20) {
            q = q.slice(1, null);
        }
        Application.Storage.setValue("queue", q as Array<Application.PropertyValueType>);
    }

    //! Send the oldest queued action; continues until the queue is empty,
    //! then refreshes the task list from the server.
    function flush() as Void {
        if (_busy) {
            return;
        }
        var q = queue();
        if (q.size() == 0) {
            return;
        }
        var head = q[0] as Array;
        _busy = true;
        Communications.makeWebRequest(
            Api.url(head[0] as String),
            head[1] as Dictionary<Object, Object>,
            Api.options(Communications.HTTP_REQUEST_METHOD_POST),
            method(:onPosted)
        );
    }

    function onPosted(code as Number, data as Dictionary or String or Null) as Void {
        _busy = false;
        // 2xx done; 400/404 will never succeed (bad id, deleted task): drop it too
        if ((code >= 200 && code < 300) || code == 400 || code == 404) {
            var q = queue();
            Application.Storage.setValue("queue", q.size() > 1 ? q.slice(1, null) as Array<Application.PropertyValueType> : []);
            if (q.size() > 1) {
                flush();
            } else {
                refresh();
            }
            return;
        }
        // Phone unreachable (negative BLE codes) or server error: keep for later
        setStatus(code < 0 ? "Phone not connected" : "Server error " + code.format("%d"));
    }

    function refresh() as Void {
        if (_busy) {
            return;
        }
        _busy = true;
        Communications.makeWebRequest(
            Api.url("/tasks"),
            null,
            Api.options(Communications.HTTP_REQUEST_METHOD_GET),
            method(:onTasks)
        );
    }

    function onTasks(code as Number, data as Dictionary or String or Null) as Void {
        _busy = false;
        if (code == 200 && data instanceof Dictionary) {
            // Don't let a stale server copy undo actions still in the queue
            if (queue().size() == 0) {
                TaskStore.saveTasks(TaskStore.rows(data), data["readiness"] as Application.PersistableType, data["dueNow"] as Application.PersistableType);
            }
            _status = "";
            rebuild();
            alertNewDue();
        } else {
            setStatus(code < 0 ? "Phone not connected" : "Sync error " + code.format("%d"));
        }
    }

    //! "Sync now" item
    function syncNow() as Void {
        _status = "Syncing...";
        rebuild();
        if (queue().size() > 0) {
            flush();
        } else {
            refresh();
        }
    }
}

//! Status dot left of each task: gold = done, gold ring = due now,
//! navy ring = pending, half ring = snoozed, dash = skipped.
class StatusIcon extends WatchUi.Drawable {
    private var _status as String;
    private var _due as Boolean;

    function initialize(status as String, due as Boolean) {
        Drawable.initialize({});
        _status = status;
        _due = due;
    }

    function draw(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        var cy = h / 2;
        var r = (w < h ? w : h) / 2 - 6;
        if (r < 6) {
            r = 6;
        }
        if (r > 16) {
            r = 16;
        }
        dc.setPenWidth(3);
        if (_status.equals("done")) {
            dc.setColor(UI_GOLD, Graphics.COLOR_TRANSPARENT);
            dc.fillCircle(cx, cy, r);
        } else if (_status.equals("skipped")) {
            dc.setColor(UI_MUTED, Graphics.COLOR_TRANSPARENT);
            dc.drawLine(cx - r, cy, cx + r, cy);
        } else if (_status.equals("snoozed")) {
            dc.setColor(UI_MUTED, Graphics.COLOR_TRANSPARENT);
            dc.drawArc(cx, cy, r, Graphics.ARC_COUNTER_CLOCKWISE, 90, 270);
        } else {
            dc.setColor(_due ? UI_GOLD : UI_NAVY, Graphics.COLOR_TRANSPARENT);
            dc.drawCircle(cx, cy, r);
        }
        dc.setPenWidth(1);
    }
}

class TaskMenuDelegate extends WatchUi.Menu2InputDelegate {
    private var _c as TaskController;

    function initialize(c as TaskController) {
        Menu2InputDelegate.initialize();
        _c = c;
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var id = item.getId();
        if (id instanceof String) {
            var row = TaskStore.find(id);
            var label = row != null && row[TaskStore.TITLE] instanceof String ? row[TaskStore.TITLE] as String : "Task";
            var menu = new WatchUi.Menu2({ :title => TaskUi.clip(label, 18) });
            menu.addItem(new WatchUi.MenuItem("Done", null, :done, null));
            menu.addItem(new WatchUi.MenuItem("Snooze " + SNOOZE_MINUTES.format("%d") + " min", null, :snooze, null));
            menu.addItem(new WatchUi.MenuItem("Skip", "Pick a reason", :skip, null));
            WatchUi.pushView(menu, new TaskActionDelegate(_c, id), WatchUi.SLIDE_LEFT);
        } else if (id == :capture) {
            var menu = new WatchUi.Menu2({ :title => "Capture" });
            menu.addItem(new WatchUi.MenuItem("Idea", null, "idea", null));
            menu.addItem(new WatchUi.MenuItem("Low energy", null, "low_energy", null));
            menu.addItem(new WatchUi.MenuItem("Distracted", null, "distracted", null));
            menu.addItem(new WatchUi.MenuItem("Break", null, "break", null));
            menu.addItem(new WatchUi.MenuItem("Win", null, "win", null));
            WatchUi.pushView(menu, new CaptureDelegate(_c), WatchUi.SLIDE_LEFT);
        } else if (id == :refresh || id == :none) {
            _c.syncNow();
        }
    }
}

class TaskActionDelegate extends WatchUi.Menu2InputDelegate {
    private var _c as TaskController;
    private var _id as String;

    function initialize(c as TaskController, id as String) {
        Menu2InputDelegate.initialize();
        _c = c;
        _id = id;
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var id = item.getId();
        if (id == :skip) {
            var menu = new WatchUi.Menu2({ :title => "Skip because" });
            menu.addItem(new WatchUi.MenuItem("Busy", null, "busy", null));
            menu.addItem(new WatchUi.MenuItem("Low energy", null, "low_energy", null));
            menu.addItem(new WatchUi.MenuItem("Not needed", null, "not_needed", null));
            WatchUi.pushView(menu, new SkipReasonDelegate(_c, _id), WatchUi.SLIDE_LEFT);
            return;
        }
        _c.act(_id, id == :snooze ? "snooze" : "done", null);
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
    }
}

class SkipReasonDelegate extends WatchUi.Menu2InputDelegate {
    private var _c as TaskController;
    private var _id as String;

    function initialize(c as TaskController, id as String) {
        Menu2InputDelegate.initialize();
        _c = c;
        _id = id;
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var reason = item.getId();
        _c.act(_id, "skip", reason instanceof String ? reason : null);
        // Back to the task list: close reasons and the action menu
        WatchUi.popView(WatchUi.SLIDE_IMMEDIATE);
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
    }
}

class CaptureDelegate extends WatchUi.Menu2InputDelegate {
    private var _c as TaskController;

    function initialize(c as TaskController) {
        Menu2InputDelegate.initialize();
        _c = c;
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var kind = item.getId();
        if (kind instanceof String) {
            _c.capture(kind);
        }
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
    }
}
