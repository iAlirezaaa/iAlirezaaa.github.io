/* HADES / PUBLIC REVIEW — Adobe After Effects ExtendScript. No artwork changes. */
(function () {
    var comp = app.project && app.project.activeItem;
    var cues = [[0,12,"Pre-roll"],[12,24,"Title in"],[24,108,"Title hold"],[108,120,"Title out"],[120,144,"Post-roll"]];
    if (!(comp instanceof CompItem) || Math.abs(comp.frameRate - 24) > 0.00001 || comp.duration < 6 - 0.00001 || Math.abs(comp.displayStartTime) > 0.00001 || !comp.markerProperty) {
        alert("HADES REVIEW: Select a 24 fps composition, at least 6 seconds long, with start time 0 and composition marker support.");
        return;
    }
    var markers = comp.markerProperty;
    for (var k = 1; k <= markers.numKeys; k++) {
        var t = markers.keyTime(k);
        if (t < 6 && t + markers.keyValue(k).duration >= 0) {
            alert("HADES REVIEW: Existing marker in the first six seconds. No changes made. Use a duplicate composition.");
            return;
        }
    }
    var inserted = [];
    app.beginUndoGroup("HADES REVIEW timing markers");
    try {
        for (var i = 0; i < cues.length; i++) {
            var cue = cues[i], start = cue[0] / 24;
            var m = new MarkerValue("HADES REVIEW | " + cue[2]);
            m.duration = (cue[1] - cue[0]) / 24;
            markers.setValueAtTime(start, m);
            inserted.push(start);
        }
        alert("HADES REVIEW: Five composition markers added. Artwork unchanged. Undo removes the group.");
    } catch (e) {
        var rollbackFailed = false;
        for (var j = inserted.length - 1; j >= 0; j--) {
            try {
                var index = markers.nearestKeyIndex(inserted[j]);
                if (Math.abs(markers.keyTime(index) - inserted[j]) < 0.00001) markers.removeKey(index);
            } catch (rollbackError) { rollbackFailed = true; }
        }
        alert("HADES REVIEW: Import stopped. " + (rollbackFailed ? "Use Undo to restore the composition. " : "Recorded insertions removed. ") + e.toString());
    } finally { app.endUndoGroup(); }
}());
