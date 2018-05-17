local events = require("events")

local notes = [[
This is the notes string.

We embed this in Lua just to show how this is done.
]]

events.on("post-render", function(_)
  -- This is how to set notes from Lua
  _.Notes = notes

  -- Now we can modify manifests
  -- FIXME: This is causing an infinite loop because _.Manifests is not an
  -- iterator.
  -- for val in _.Manifests do
  for i = 1, #_.Manifests do
    print(_.Manifests[i])
  end
end)


