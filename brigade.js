const { events, Job, Group } = require("brigadier");

events.on("check_suite:requested", runSuite);
events.on("check_suite:rerequested", runSuite);
events.on("check_run:rerequested", runSuite);

function runSuite(e, p) {
    runDCO(e, p).catch(e => {console.error(e.toString())});
    runUnitTests(e, p).catch(e => {console.error(e.toString())});
    runStyleTests(e, p).catch(e => {console.error(e.toString())});
    runAnalytics(e, p).catch(e => {console.error(e.toString())});
}

// Run tests and fail if the tests do not pass.
function runUnitTests(e, p) {
    const command = "make bootstrap test-unit";
    var note = new Notification("tests", e, p);
    note.conclusion = "";
    note.title = "Run Tests"
    note.summary = "Running the test target for " + e.revision.commit;

    var job = new GoJob("run-tests", e, p);
    job.tasks.push(command);
    return notificationWrap(job, note)
}

async function runStyleTests(e, p) {
    const command = "make bootstrap test-style";
    var note = new Notification("style", e, p);
    note.conclusion = "";
    note.title = "Run Style Tests"
    note.summary = "Running the style test target for " + e.revision.commit;
    var job = new GoJob("run-style", e, p);
    job.tasks.push(command);

    return notificationWrap(job, note);
}

// Run analytics, but don't fail unless something breaks internally.
function runAnalytics(e, p) {
    const commands = [
        "make bootstrap",
        "go get github.com/fzipp/gocyclo",
        "go get honnef.co/go/tools/cmd/staticcheck",
        "go get github.com/walle/lll/...",
    `
    set +e
    for pkg in $(go list ./... | grep -v /vendor/); 
      do
        echo "==> $pkg";
        gocyclo -over 10 $GOPATH/src/"$pkg";
        lll --maxlength 120  $GOPATH/src/"$pkg";
        staticcheck "$pkg";
      done
      exit 0`
    ];
    var note = new Notification("analytics", e, p);
    note.conclusion = "";
    note.title = "Run Style Tests"
    note.summary = "Running the style test target for " + e.revision.commit;
    var job = new GoJob("run-style", e, p);
    Array.prototype.push.apply(job.tasks, commands);

    return notificationWrap(job, note, "neutral");
}

// Not as cool as runDMC.
function runDCO(e, p) {
    const ghData = JSON.parse(e.payload);
    var dco = new Notification("dco", e, p);
    dco.title = "Developer Certificate of Origin (DCO)"

    const re = new RegExp(/Signed off by:(.*)/, 'i');

    // TODO: this should be a regexp.
    const signedOff = re.exec(ghData.body.check_suite.head_commit.message);
    if (signedOff == null){
        dco.summary = "DCO check failed: Not signed off."
        dco.text = "This commit is inelligible for merging until it is signed off. https://developercertificate.org/";
        dco.conclusion = "failure";
    } else {
        dco.summary = "DCO check succeeded";
        dco.text = `Commit signed by ${ signedOff[1] }`;
        dco.conclusion = "success";
    }
    
    console.log(dco.summary);
    return dco.run();
}

async function notificationWrap(job, note, conclusion) {
    if (conclusion == null) {
        conclusion = "success"
    }
    await note.run();
    try {
        let res = await job.run()
        const logs = await job.logs();

        note.conclusion = conclusion;
        note.summary = `Task "${ job.name }" passed`;
        note.text = note.text = "```" + logs + "```\nSuccess: " + res.toString();
    } catch (e) {
        const logs = await job.logs();
        note.conclusion = "failure";
        note.summary = `Task "${ job.name }" failed for ${ e.buildID }`;
        note.text = "```" + logs + "```\nFailed with error: " + e.toString();
        try {
            return await note.run();
        } catch (e2) {
            console.error("failed to send notification: " + e2.toString());
            console.error("original error: " + e.toString());
            return e2;
        }
    }
}

class Notification {
    constructor(name, e, p) {
        this.proj = p;
        this.payload = e.payload;
        this.name = name;
        this.externalID = e.buildID;
        this.detailsURL = `https://azure.github.com/kashti/builds/${ e.buildID }`;

        // count allows us to send the notification multiple times, with a distinct pod name
        // each time.
        this.count = 0;

        // One of: "success", "failure", "neutral", "cancelled", or "timed_out".
        this.conclusion = "neutral";
        this.title = "running check";
        this.text = "";
        this.summary = ""
    }

    // Send a new notification, and return a Promise<result>.
    run() {
        this.count++
        console.log("create new job")
        var j = new Job(`${ this.name }-${ this.count }`, "technosophos/brigade-github-check-run:latest");
        console.log("set environment vars")
        j.env = {
            CHECK_CONCLUSION: this.conclusion,
            CHECK_NAME: this.name,
            CHECK_TITLE: this.title,
            CHECK_PAYLOAD: this.payload,
            CHECK_SUMMARY: this.summary,
            CHECK_TEXT: this.text,
            CHECK_DETAILS_URL: this.detailsURL,
            CHECK_EXTERNAL_ID: this.externalID
        }
        console.log("run job")
        return j.run();
    }
}

class GoJob extends Job {
    constructor(name, e, project) {
        super(name, "golang:1.9");

        this.e = e;
        this.project = project;
        const gopath = "/go"
        const localPath = gopath + "/src/github.com/" + project.repo.name;
        this.tasks = [
            "go get github.com/golang/dep/cmd/dep",
            "mkdir -p " + localPath,
            "mv /src/* " + localPath,
            "cd " + localPath,
            "dep ensure",
        ];
    }
}