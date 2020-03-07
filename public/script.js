function onRSVPChange(event, id) {
    let countField = document.getElementById(id);
    if (event.target.value == 'yes') {
        countField.required = true;
        countField.disabled = false;
    } else {
        countField.required = false;
        countField.disabled = true;
    }
}
