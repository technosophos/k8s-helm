local events = require("events")

events.on("pre-render", function(ctx)
  print("===> pre-render")
  print(ctx.Chart.Metadata.Name)
  ctx.Chart.Metadata.Name = "stinky"
end)

events.on("post-render", function(ctx)
  print("===> post-render")
  print(ctx.Chart.Metadata.Name)
end)
