// location-photos.js
// Halaman galeri foto lokasi billboard (static JSON).
// Kunci lokasi mengikuti nilai filter lokasi di dashboard: pasir-kaliki | hang-tuah | raya-darmo, dst.

async function loadPhotoMap() {
  const res = await fetch("data/location_photos.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal memuat data/location_photos.json");
  return res.json();
}

function getSelectedLocationKey() {
  try {
    return localStorage.getItem("selected_location_key") || "pasir-kaliki";
  } catch (e) {
    return "pasir-kaliki";
  }
}

function renderPhotos(locKey, photos) {
  const grid = document.getElementById("photoGrid");
  const empty = document.getElementById("photoEmpty");
  const meta = document.getElementById("photoMeta");

  if (!grid || !empty || !meta) return;

  grid.innerHTML = "";
  meta.textContent = `Lokasi: ${locKey} • Total Foto: ${photos.length}`;

  if (!photos.length) {
    empty.classList.remove("d-none");
    return;
  }
  empty.classList.add("d-none");

  for (const p of photos) {
    const col = document.createElement("div");
    col.className = "col-12 col-sm-6 col-lg-4";

    const url = p.url || "";
    const caption = p.caption || "";

    col.innerHTML = `
      <div class="card h-100">
        <img src="${url}" class="card-img-top" style="object-fit:cover; height:220px;" alt="">
        <div class="card-body">
          <div class="small text-muted">${caption}</div>
        </div>
      </div>
    `;
    grid.appendChild(col);
  }
}

async function refresh() {
  const locKey = getSelectedLocationKey();
  const map = await loadPhotoMap();
  const photos = map[locKey] || [];
  renderPhotos(locKey, photos);
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnRefreshPhotos");
  if (btn) btn.addEventListener("click", refresh);
  refresh().catch((err) => {
    const meta = document.getElementById("photoMeta");
    if (meta) meta.textContent = `Error: ${err.message}`;
  });
});
