import Toybox.Application;
import Toybox.Background;
import Toybox.Lang;
import Toybox.System;
import Toybox.Time;
import Toybox.WatchUi;

//! Watch face in the Goal Tracker style. Also sends sensor data to the
//! app every 5 minutes in the background (see ../garmin-shared).
(:background)
class GoalFaceApp extends Application.AppBase {

    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() as [WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates] {
        Background.registerForTemporalEvent(new Time.Duration(5 * 60));
        return [new GoalFaceView()];
    }

    function getServiceDelegate() as [System.ServiceDelegate] {
        return [new SyncServiceDelegate()];
    }

    function onBackgroundData(data as Application.PersistableType) as Void {
        Application.Storage.setValue("lastResult", data);
        Application.Storage.setValue("lastTime", Time.now().value());
    }
}
