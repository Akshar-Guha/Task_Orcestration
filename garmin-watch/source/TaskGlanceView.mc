import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

//! Glance: next routine task + readiness. Two lines, nothing else.
(:glance)
class TaskGlanceView extends WatchUi.GlanceView {

    function initialize() {
        GlanceView.initialize();
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        var line1 = "No task due";
        var row = TaskStore.next();
        var gold = false;
        if (row != null) {
            var title = row[TaskStore.TITLE] instanceof String ? row[TaskStore.TITLE] as String : "";
            var due = row[TaskStore.DUE] instanceof String ? row[TaskStore.DUE] as String : "";
            line1 = fit(dc, due + " " + title, Graphics.FONT_TINY, w);
            var id = row[TaskStore.ID];
            gold = id instanceof String && TaskStore.isDue(id);
        } else if (!TaskStore.fresh()) {
            line1 = "Goal Tracker";
        }

        var r = TaskStore.readiness();
        var p = TaskStore.progress();
        var line2 = (r != null ? "Readiness " + r.format("%d") : "Readiness --");
        if (p[1] > 0) {
            line2 += " · " + p[0].format("%d") + "/" + p[1].format("%d");
        }

        dc.setColor(gold ? 0xD4A853 : Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        // Stack both lines around the vertical centre of the glance area
        var h1 = dc.getFontHeight(Graphics.FONT_TINY);
        var h2 = dc.getFontHeight(Graphics.FONT_XTINY);
        var top = (h - h1 - h2) / 2;
        if (top < 0) {
            top = 0;
        }
        dc.drawText(0, top, Graphics.FONT_TINY, line1, Graphics.TEXT_JUSTIFY_LEFT);
        dc.setColor(0x6A7F96, Graphics.COLOR_TRANSPARENT);
        dc.drawText(0, top + h1, Graphics.FONT_XTINY, line2, Graphics.TEXT_JUSTIFY_LEFT);
    }

    //! Drop characters until the text fits the glance width
    private function fit(dc as Graphics.Dc, s as String, font as Graphics.FontType, w as Number) as String {
        var out = s;
        while (out.length() > 4 && dc.getTextWidthInPixels(out, font) > w) {
            var shorter = out.substring(0, out.length() - 2);
            out = shorter != null ? shorter : out;
        }
        return out;
    }
}
