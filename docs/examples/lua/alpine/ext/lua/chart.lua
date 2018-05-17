-- This script defines the Alpine pod during the post-install event.
local events = require("events")
local yaml = require("yaml")

-- Use functions to encapsulate common logic
function alpine_name(_)
  return _.Values.nameOverride or _.Chart.Name

end

function alpine_fullname(_)
  return alpine_name(_) .. "-" .. _.Release.Name
end

-- create_alpine_pod creates a new Alpine pod definition
-- This later gets specified as an event handler.
function create_alpine_pod(_)
  local pod = {
    apiVersion = "v1",
    kind = "Pod",
    metadata = {
      name = alpine_fullname(_),
      labels = {
        heritage = _.Release.Service or "helm",
        release = _.Release.Name,
        chart = _.Chart.Name .. "-" .. _.Chart.Version,
        app = alpine_name(_)
      }
    },
    spec = {
      restartPolicy = _.Values.restartPolicy,
      containers = {
        {
          name = waiter,
          image = _.Values.image.repository .. ":" .. _.Values.image.tag,
          imagePullPolicy = _.Values.image.pullPolicy,
          command = {
            "/bin/sleep",
            "9000"
          }
        }
      }
    }
  }

  _.Manifests = {
    yaml.encode(pod)
  }
end

-- Register create_alpine_pod as an event handler for "pre-render"
events.on("post-render", create_alpine_pod)
