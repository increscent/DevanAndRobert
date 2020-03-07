function onReceptionChange(event) {
    let countField = document.getElementById('reception_guest_count');
    if (event.target.value == 'yes') {
        countField.required = true;
        countField.disabled = false;
    } else {
        countField.required = false;
        countField.disabled = true;
    }
}
