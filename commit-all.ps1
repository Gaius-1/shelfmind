$files = git ls-files -m -o -d --exclude-standard | Sort-Object -Unique
foreach ($f in $files) {
    if (-not [string]::IsNullOrWhiteSpace($f)) {
        git add --all $f
        
        $filename = Split-Path $f -Leaf
        $msg = "Update $filename"
        
        # Relatable messages
        if ($f -match "package\.json") { $msg = "Update package dependencies and scripts" }
        elseif ($f -match "bun\.lock") { $msg = "Update bun lockfile" }
        elseif ($f -match "CustomNode\.tsx") { $msg = "Implement custom nodes for React Flow pipeline" }
        elseif ($f -match "PipelineVisualizer\.tsx") { $msg = "Build 8-stage pipeline visualizer canvas" }
        elseif ($f -match "app-sidebar\.tsx") { $msg = "Update sidebar navigation for pipeline workflow" }
        elseif ($f -match "svgs[\\/].*") { $msg = "Add beautiful SVGL icon $filename" }
        elseif ($f -match "\.tsx$") { $msg = "Refine UI component: $filename" }
        elseif ($f -match "schema\.ts") { $msg = "Update database schema definition" }
        elseif ($f -match "\.ts$") { $msg = "Update logic in $filename" }
        elseif ($f -match "\.css$") { $msg = "Update styling in $filename" }
        elseif ($f -match "\.sql$") { $msg = "Update database migration: $filename" }
        elseif ($f -match "\.json$") { $msg = "Update configuration: $filename" }
        elseif ($f -match "\.jsonc$") { $msg = "Update configuration: $filename" }
        elseif ($f -match "dev\.db") { $msg = "Update local dev database state" }
        elseif ($f -match "SKILL\.md") { $msg = "Add agent skill instructions: $filename" }
        
        Write-Host "Committing $f -> $msg"
        git commit -m $msg
    }
}
