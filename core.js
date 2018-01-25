let debug = window.location.hostname === 'localhost';

const pipe = (...funcs) => i => funcs.reduce((p, c) => c(p), i);
const create = (item, ...funcs) => funcs.reduce((p, c) => c(p), item);

const getJson = url => fetch(url).then(response => response.json());
const getLocalJson = filename => fetch(`data/${filename}.json`,{credentials: 'same-origin'}).then(r => r.json());
const getHostname = urlString => new URL(urlString).hostname;
const postJson = (url, object) => fetch(url, {
    method: "post",
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(object)
});

const forAll = (items, htmlCallback) => items && items instanceof Array ? items.map(htmlCallback).join('') : '';
const ifExists = (item, htmlCallback) => item ? htmlCallback(item) : '';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const xx = x => (x < 10 ? '0' : '') + x;
const formatDate = date => `${months[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`;
const formatTime = date => `${xx(date.getHours())}:${xx(date.getMinutes())}:${xx(date.getSeconds())}`;

const tag = (name, attributes) => {
    const element = document.createElement(name);
    if(attributes) {
        for(const attribute of Object.keys(attributes)) {
            element.setAttribute(attribute, attributes[attribute]);
        }
    }
    return element;
};
tag.fromString = string => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = string;
    return wrapper.firstElementChild;
};
const appendTo = container => element => container.appendChild(element);
function bindRadios(name, form) {
    const radios = form.querySelectorAll(`[name=${name}]`);
    const panels = Array.from(radios).map(radio => form.querySelector(`#details_${radio.value}`));
    for (const radio of radios) {
        radio.onchange = () => {
            panels.forEach(p => {
                const hide = p.id !== `details_${radio.value}`;
                p.hidden = hide;
                p.querySelectorAll('input,textarea').forEach(i => i.disabled = hide);
            });
        };
    }
    radios.item(0).checked = true;
    radios.item(0).onchange();
}
function Submission(form) {
    const inputs = Array.from(form.elements)
        .filter(el => el.validity.valid && el.value !== '' && (el.type !== 'radio' || el.checked));
    const submission = {};
    for(const input of inputs) {
        submission[input.name] = input.value;
    }
    return submission;
}
const onSubmit = form_event => form => {
    form.onsubmit = form_event(form);
    return form;
};
const getParams = query => {
    if (!query) {
        return { };
    }

    return (/^[?#]/.test(query) ? query.slice(1) : query)
        .split('&')
        .reduce((params, param) => {
            let [ key, value ] = param.split('=');
            params[key] = value ? decodeURIComponent(value
                // .replace(/\+/g, ' ')
            ) : '';
            return params;
        }, { });
};
const setParams = params => {
    if(Object.keys(params).length) {
        const value = Object.keys(params)
            .map(k => `${k}=${encodeURIComponent(params[k]
                // .replace(/ /g, '+')
            )}`)
            .join('&');

        history.replaceState({}, null, `?${value}`);
    } else {
        history.replaceState({}, null, `?`);
    }
};