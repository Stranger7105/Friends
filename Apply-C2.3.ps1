$ErrorActionPreference = "Stop"

$pagePath = Join-Path $PSScriptRoot "app\feed\page.tsx"

if (-not (Test-Path $pagePath)) {
  throw "Nu găsesc app\feed\page.tsx. Rulează scriptul din rădăcina proiectului Friends."
}

$content = Get-Content -Raw -Encoding UTF8 $pagePath

$oldContentLine = @'
    const content = postText.trim();
    if ((!content && !selectedImage) || !currentUserId || publishing) return;
'@

$newContentLine = @'
    const content = postText.trim();
    const formData = new FormData(event.currentTarget);
    const audienceTypeValue = formData.get("audience_type");
    const audienceGroupValue = formData.get("audience_group_id");

    const audienceType =
      audienceTypeValue === "group" || audienceTypeValue === "private"
        ? audienceTypeValue
        : "friends";

    const audienceGroupId =
      audienceType === "group" &&
      typeof audienceGroupValue === "string" &&
      audienceGroupValue
        ? audienceGroupValue
        : null;

    if ((!content && !selectedImage) || !currentUserId || publishing) return;
'@

if (-not $content.Contains($oldContentLine)) {
  throw "Nu am găsit începutul funcției handlePublish în forma așteptată. Nu am modificat fișierul."
}

$content = $content.Replace($oldContentLine, $newContentLine)

$oldInsert = @'
      const { error } = await supabase.from("posts").insert({
        content,
        user_id: currentUserId,
        image_path: uploadedPath,
      });
'@

$newInsert = @'
      const { error } = await supabase.from("posts").insert({
        content,
        user_id: currentUserId,
        image_path: uploadedPath,
        audience_type: audienceType,
        audience_group_id: audienceGroupId,
      });
'@

if (-not $content.Contains($oldInsert)) {
  throw "Nu am găsit INSERT-ul în posts în forma așteptată. Nu am modificat fișierul."
}

$content = $content.Replace($oldInsert, $newInsert)

Copy-Item $pagePath "$pagePath.c23-backup" -Force
Set-Content -Path $pagePath -Value $content -Encoding UTF8

Write-Host ""
Write-Host "C2.3 a fost aplicat cu succes." -ForegroundColor Green
Write-Host "Backup creat: app\feed\page.tsx.c23-backup"
Write-Host "Acum pornește serverul și testează cele 3 audiențe."
