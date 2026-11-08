import Toybox.Application;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Time;
import Toybox.WatchUi;

class WatchSyncView extends WatchUi.View {

    function initialize() {
        View.initialize();
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();
        var cx = dc.getWidth() / 2;
        var cy = dc.getHeight() / 2;

        var code = Application.Storage.getValue("lastResult");
        var time = Application.Storage.getValue("lastTime");

        var status = "Waiting for first sync";
        if (code != null && time != null) {
            var mins = (Time.now().value() - (time as Number)) / 60;
            status = ((code as Number) == 200 ? "Synced " : "Error " + code + ", ") + mins + " min ago";
        }

        dc.drawText(cx, cy - 40, Graphics.FONT_SMALL, "Goal Tracker Sync", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(cx, cy, Graphics.FONT_XTINY, "Sends data every 5 min", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(cx, cy + 30, Graphics.FONT_XTINY, status, Graphics.TEXT_JUSTIFY_CENTER);
    }
}
