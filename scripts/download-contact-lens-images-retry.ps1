$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'images\contact-lenses'
$hdr = @{ 'User-Agent' = 'EyeNoonLocalMirror/1.0 (asset migration retry)' }

$items = @(
  @{ slug = 'acuvue-oasys-hydraluxe-toric-3-months'; url = 'https://www.eyenoonoptical.com/product-page/acuvue-oasys-hydraluxe-toric-3-months' }
  @{ slug = 'ciba-vision-dailies-total-1-3-months'; url = 'https://www.eyenoonoptical.com/product-page/ciba-vision-dailies-total-1-3-months' }
  @{ slug = 'ciba-vision-aqua-comfort-plus-3-months'; url = 'https://www.eyenoonoptical.com/product-page/ciba-vision-aqua-comfort-plus-3-months' }
  @{ slug = 'alcon-dailies-aqua-comfort-plus-multifocal-3-months'; url = 'https://www.eyenoonoptical.com/product-page/alcon-dailies-aqua-comfort-plus-multifocal-3-months' }
  @{ slug = 'bausch-lomb-biotrue-oneday-3-months'; url = 'https://www.eyenoonoptical.com/product-page/bausch-lomb-biotrue-oneday-3-months' }
  @{ slug = 'bausch-lomb-infuse-1-day-3-months'; url = 'https://www.eyenoonoptical.com/product-page/bausch-lomb-infuse-1-day-3-months' }
  @{ slug = 'bausch-lomb-infuse-1-day-toric-3-months'; url = 'https://www.eyenoonoptical.com/product-page/bausch-lomb-infuse-1-day-toric-3-months' }
  @{ slug = 'bausch-lomb-infuse-1-day-multifocal-3-months'; url = 'https://www.eyenoonoptical.com/product-page/bausch-lomb-infuse-1-day-multifocal-3-months' }
  @{ slug = 'coopervision-myday-1-day-3-months'; url = 'https://www.eyenoonoptical.com/product-page/coopervision-myday-1-day-3-months' }
  @{ slug = 'coopervision-myday-1-day-toric-3-months'; url = 'https://www.eyenoonoptical.com/product-page/coopervision-myday-1-day-toric-3-months' }
  @{ slug = 'cooper-vision-proclear-1-day-3-months'; url = 'https://www.eyenoonoptical.com/product-page/cooper-vision-proclear-1-day-3-months' }
  @{ slug = 'coopervision-proclear-1-day-multifocal-3-months'; url = 'https://www.eyenoonoptical.com/product-page/coopervision-proclear-1-day-multifocal-3-months' }
  @{ slug = 'cooper-vision-clariti-1-day-3-months'; url = 'https://www.eyenoonoptical.com/product-page/cooper-vision-clariti-1-day-3-months' }
  @{ slug = 'coopervision-clariti-1-day-toric-3-months'; url = 'https://www.eyenoonoptical.com/product-page/coopervision-clariti-1-day-toric-3-months' }
  @{ slug = 'acuvue-2-6-months'; url = 'https://www.eyenoonoptical.com/product-page/acuvue-2-6-months' }
  @{ slug = 'acuvue-oasys-6-months'; url = 'https://www.eyenoonoptical.com/product-page/acuvue-oasys-6-months' }
  @{ slug = 'acuvue-oasys-toric-6-months'; url = 'https://www.eyenoonoptical.com/product-page/acuvue-oasys-toric-6-months' }
  @{ slug = 'acuvue-vita-6-months'; url = 'https://www.eyenoonoptical.com/product-page/acuvue-vita-6-months' }
  @{ slug = 'acuvue-vita-6-months-1'; url = 'https://www.eyenoonoptical.com/product-page/acuvue-vita-6-months-1' }
  @{ slug = 'alcon-air-optix-night-day-6-months'; url = 'https://www.eyenoonoptical.com/product-page/alcon-air-optix-night-day-6-months' }
  @{ slug = 'alcon-air-optix-toric-6-months'; url = 'https://www.eyenoonoptical.com/product-page/alcon-air-optix-toric-6-months' }
  @{ slug = 'alcon-air-optix-aqua-multifocal-6-months'; url = 'https://www.eyenoonoptical.com/product-page/alcon-air-optix-aqua-multifocal-6-months' }
  @{ slug = 'coopervision-proclear-toric-6-months'; url = 'https://www.eyenoonoptical.com/product-page/coopervision-proclear-toric-6-months' }
  @{ slug = 'coopervision-proclear-toric-xr-6-months'; url = 'https://www.eyenoonoptical.com/product-page/coopervision-proclear-toric-xr-6-months' }
  @{ slug = 'coopervision-proclear-multifocal-6-months'; url = 'https://www.eyenoonoptical.com/product-page/coopervision-proclear-multifocal-6-months' }
  @{ slug = 'coopervision-biofinity-6-months'; url = 'https://www.eyenoonoptical.com/product-page/coopervision-biofinity-6-months' }
  @{ slug = 'coopervision-biofinity-xr-6-months'; url = 'https://www.eyenoonoptical.com/product-page/coopervision-biofinity-xr-6-months' }
  @{ slug = 'coopervision-biofinity-toric-6-months'; url = 'https://www.eyenoonoptical.com/product-page/coopervision-biofinity-toric-6-months' }
  @{ slug = 'coopervision-biofinity-toric-xr-6months'; url = 'https://www.eyenoonoptical.com/product-page/coopervision-biofinity-toric-xr-6months' }
  @{ slug = 'monthly-eyedia-clearcolor-6-months-1'; url = 'https://www.eyenoonoptical.com/product-page/monthly-eyedia-clearcolor-6-months-1' }
  @{ slug = 'monthly-alcon-air-optix-colors-6-months'; url = 'https://www.eyenoonoptical.com/product-page/monthly-alcon-air-optix-colors-6-months' }
  @{ slug = 'monthly-eyedia-clearcolor-6-months'; url = 'https://www.eyenoonoptical.com/product-page/monthly-eyedia-clearcolor-6-months' }
)

foreach ($it in $items) {
  $existing = Get-ChildItem -Path $outDir -Filter ($it.slug + '.*') -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "EXISTS $($it.slug)"
    continue
  }
  $attempt = 0
  while ($attempt -lt 5) {
    $attempt++
    try {
      $html = (Invoke-WebRequest -Uri $it.url -Headers $hdr -UseBasicParsing -TimeoutSec 60).Content
      if ($html -match 'property="og:image" content="([^"]+)"') {
        $imgUrl = $Matches[1]
        $ext = '.jpg'
        if ($imgUrl -match '\.(png|webp|jpeg|jpg)(\?|$)') { $ext = '.' + $Matches[1]; if ($ext -eq '.jpeg') { $ext = '.jpg' } }
        $dest = Join-Path $outDir ($it.slug + $ext)
        Invoke-WebRequest -Uri $imgUrl -Headers $hdr -OutFile $dest -TimeoutSec 90
        Write-Host "OK $($it.slug)"
        break
      }
    }
    catch {
      Write-Host "attempt $attempt $($it.slug): $($_.Exception.Message)"
    }
    Start-Sleep -Seconds (6 + $attempt * 2)
  }
  Start-Sleep -Seconds 5
}
