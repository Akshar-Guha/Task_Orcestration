import Toybox.Application;
import Toybox.Background;
import Toybox.Lang;
import Toybox.System;
import Toybox.Time;
import Toybox.WatchUi;

//! Goal Tracker on the wrist:
//!  - background (every 5 min): sends sensor data, fetches today's routine
//!    tasks, and asks to open the app when one becomes due
//!  - app: today's routine tasks with Done / Snooze / Skip, plus quick capture
//!  - glance: next task + readiness
(:background :glance)
class WatchSyncApp extends Application.AppBase {

    //! True only in the full app process (not background, not glance)
    private var _foreground as Boolean = false;

    function initialize() {
        AppBase.initialize();
    }

    function onStart(state as Dictionary?) as Void {
    }

    function onStop(state as Dictionary?) as Void {
        if (_foreground) {
            Application.Storage.deleteValue("fgAt");
        }
    }

    (:typecheck(disableBackgroundCheck))
    function getInitialView() as [WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates] {
        // 5 minutes is the shortest interval Connect IQ allows
        Background.registerForTemporalEvent(new Time.Duration(5 * 60));
        _foreground = true;
        Application.Storage.setValue("fgAt", Time.now().value());
        return TaskUi.initialView();
    }

    (:glance)
    function getGlanceView() as [WatchUi.GlanceView] or [WatchUi.GlanceView, WatchUi.GlanceViewDelegate] or Null {
        return [new TaskGlanceView()];
    }

    function getServiceDelegate() as [System.ServiceDelegate] {
        return [new SyncServiceDelegate(true)];
    }

    //! Called in the app/glance process only, never in the background
    (:typecheck(disableBackgroundCheck))
    function onBackgroundData(data as Application.PersistableType) as Void {
        TaskStore.save(data);
        if (_foreground) {
            Application.Storage.setValue("fgAt", Time.now().value());
            TaskUi.onNewData();
        }
        WatchUi.requestUpdate();
    }
}
