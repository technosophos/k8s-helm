const { events, Job, Group } = require("brigadier");

events.on("check_suite:requested", runSuite);
events.on("check_suite:rerequested", runSuite);
events.on("check_run:rerequested", runSuite);

function runSuite(e, p) {
    runDCO(e, p);
    //runTests(e, p);
    //runDocs(e, p);
    //runAnalytics(e, p);
}

// Run tests and fail if the tests do not pass.
async function runTests(e, p) {
    const command = "make bootstrap test";
    var note = new Notification("tests", e, p);
    note.conclusion = "";
    note.title = "Run Tests"
    note.summary = "Running the test target for " + e.revision.commit;
    await note.run();

    var job = new GoJob("tests", e, p);
    job.tasks.push(command);

    try {
        let res = await job.run()

        note.conclusion = "succeeded";
        note.summary = "Testing run passed";
        note.text = res.toString();
    } catch (e) {
        note.conclusion = "failure";
        note.summary = `Testing run failed for ${ e.buildID }`;
        note.text = e.toString();
        try {
            return await note.run();
        } catch (e2) {
            console.error("failed to send notification: " + e2.toString());
            console.error("original error: " + e.toString());
            return e2;
        }
    }
}

// Generate docs and fail of the docs cannot be generated.
function runDocs(e, p) {

}

// Run analytics, but don't fail unless something breaks internally.
function runAnalytics(e, p) {

}

// Not as cool as runDMC.
function runDCO(e, p) {
    console.log(e.payload);
    const ghData = JSON.parse(e.payload);
    var dco = new Notification("dco", e, p);
    dco.title = "Developer Certificate of Origin (DCO)"

    // TODO: this should be a regexp.
    const signedOff = ghData.body.check_suite.head_commit.message.indexOf("Signed off by:")
    if (signedOff == -1){
        dco.summary = "DCO check failed: Not signed off."
        dco.text = "This commit is inelligible for merging until it is signed off. https://developercertificate.org/";
        dco.conclusion = "failure";
    } else {
        dco.summary = "DCO check succeeded";
        dco.conclusion = "succeeded";
    }
    
    console.log(dco.summary);
    return dco.run();
}

class Notification {
    constructor(name, e, p) {
        this.proj = p;
        this.payload = e.payload;
        this.name = name;
        this.externalID = e.buildID;
        this.detailsURL = `https://azure.github.com/kashti/builds/${ e.buildID }`;

        // One of: "succeeded", "failure", "neutral", "canceled", or "timed_out".
        this.conclusion = "neutral";
        this.title = "runninc check";
        this.text = "";
        this.summary = ""
    }

    // Send a new notification, and return a Promise<result>.
    run() {
        const j = new Job(name, "technosophos/brigade-github-check-run:latest");
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
        return j.run()
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