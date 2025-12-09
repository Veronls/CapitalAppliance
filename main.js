
  function toggleSave(item) {
    let saved = JSON.parse(localStorage.getItem("savedItems") || "[]");

    // Check if already saved
    const exists = saved.find(i => i.id === item.id);

    if (!exists) {
      saved.push(item);
    } else {
      saved = saved.filter(i => i.id !== item.id);
    }

    localStorage.setItem("savedItems", JSON.stringify(saved));

    // Update button text
    const btn = document.querySelector(`button[data-id="${item.id}"]`);
    if (btn) btn.textContent = exists ? "Save" : "Saved";
  }

