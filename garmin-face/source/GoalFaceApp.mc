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
        // Watch faces can't ask to be opened, so no wake request (false):
        // a due task shows as a gold dot on the face instead.
        return [new SyncServiceDelegate(false)];
    }

    //! Sync result + today's routine tasks (see ../garmin-shared/TaskStore.mc)
    (:typecheck(disableBackgroundCheck))
    function onBackgroundData(data as Application.PersistableType) as Void {
        TaskStore.save(data);
        WatchUi.requestUpdate();
    }
}
