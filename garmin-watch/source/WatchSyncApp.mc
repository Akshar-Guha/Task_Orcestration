import Toybox.Application;
import Toybox.Background;
import Toybox.Lang;
import Toybox.System;
import Toybox.Time;
import Toybox.WatchUi;

//! Sends watch sensor data to the Goal Tracker app every 5 minutes.
//! Open the app once on the watch; after that it keeps syncing in the
//! background (through the Garmin Connect app on the paired phone).
(:background)
class WatchSyncApp extends Application.AppBase {

    function initialize() {
        AppBase.initialize();
    }

    function onStart(state as Dictionary?) as Void {
    }

    function onStop(state as Dictionary?) as Void {
    }

    function getInitialView() as [WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates] {
        // 5 minutes is the shortest interval Connect IQ allows
        Background.registerForTemporalEvent(new Time.Duration(5 * 60));
        return [new WatchSyncView()];
    }

    function getServiceDelegate() as [System.ServiceDelegate] {
        return [new SyncServiceDelegate()];
    }

    //! Result code from the last background sync, shown in the app's view
    function onBackgroundData(data as Application.PersistableType) as Void {
        Application.Storage.setValue("lastResult", data);
        Application.Storage.setValue("lastTime", Time.now().value());
        WatchUi.requestUpdate();
    }
}
