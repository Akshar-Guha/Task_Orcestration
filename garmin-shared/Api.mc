import Toybox.Communications;
import Toybox.Lang;

//! Endpoints of the Goal Tracker web app. Everything lives next to
//! Config.INGEST_URL (".../api/watch/ingest"), so Config.mc needs no new keys.
(:background)
module Api {

    //! Api.url("/tasks") -> "https://<host>/api/watch/tasks"
    function url(path as String) as String {
        var base = Config.INGEST_URL;
        var i = base.find("/ingest");
        if (i != null) {
            var head = base.substring(0, i);
            if (head != null) {
                base = head;
            }
        }
        return base + path;
    }

    //! Options for makeWebRequest. JSON in and out, watch key header.
    function options(method as Communications.HttpRequestMethod) as {
        :method as Communications.HttpRequestMethod,
        :headers as Dictionary,
        :responseType as Communications.HttpResponseContentType
    } {
        var headers = { "x-watch-key" => Config.INGEST_KEY };
        if (method == Communications.HTTP_REQUEST_METHOD_POST) {
            headers.put("Content-Type", Communications.REQUEST_CONTENT_TYPE_JSON);
        }
        return {
            :method => method,
            :headers => headers,
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        };
    }
}
