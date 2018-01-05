let posts = [];
let statusElement;
let editor;
let answers = {};
let editedAnswers = {};
let postOrder = [];

function main() {
    editor = new SimpleMDE({
        element: document.getElementById('answers'),
        spellChecker: false
    });
    if (!editor.isPreviewActive()) {
        editor.togglePreview();
    }

    statusElement = document.querySelector('#status');

    Promise.all([
        getLocalJson('pol4chanPosts'),
        getLocalJson('polTrip8chanPosts'),
        getLocalJson('cbtsNonTrip8chanPosts'),
        getLocalJson('cbtsTrip8chanPosts'),
        getLocalJson('answers'),
    ]).then(values => {
        posts = [].concat(values[0]).concat(values[1]).concat(values[2]).concat(values[3]);
        answers = values[4];
        posts.sort((a, b) => b.timestamp - a.timestamp);
        postOrder.push(...(posts.map(p => p.id).reverse()));

        render(posts);
        loadLocalAnswers();
    });

    toggleAnswers();
    // checkForNewPosts();
}

function initSearch() {
    const searchElement = document.querySelector('input[type=search]');
    searchElement.oninput = () => {
        const value = searchElement.value;

        const keywordInText = value === value.toLowerCase()
            ? text => text
                .toLowerCase()
                .includes(value)
            : text => text.includes(value);

        const ids = posts
            .filter(p => p.text && keywordInText(p.text))
            .map(p => p.id);

        applyFilter(ids);
        if (value == '')
            setParams({});
        else
            setParams({q: value});
    };

    const postLines = posts
        .filter(p => p.text)
        .map(p => ({
            id: p.id,
            lines: p
                .text
                .split('\n')
                .map(t => t.trim().replace(/[.?]/g, ''))
        }));

    const result = {};
    for (const post of postLines) {
        for (const line of post.lines) {
            if (line == '')
                continue;
            if (!result[line])
                result[line] = new Set();
            result[line].add(post.id);
        }
    }
    const resultList = Object
        .keys(result)
        .map(k => ({line: k, ids: result[k]}))
        .filter(a => a.ids.size > 2);

    resultList.sort((a, b) => b.ids.size - a.ids.size);
    const datalist = document.querySelector('#hints');
    datalist.innerHTML = resultList
        .map(i => `<option label="${i.ids.size}">${i.line}</option>`)
        .join('\n');

    const query = getParams(location.search);
    if ('q' in query) {
        searchElement.value = query.q;
        searchElement.oninput();
    }
}

function applyFilter(ids) {
    let count = 0;
    for (const element of Array.from(document.querySelectorAll('article'))) {
        if (ids.includes(element.item.id)) {
            element.hidden = false;
            count++;
        } else {
            element.hidden = true;
        }
    }
    document
        .querySelector('#count')
        .textContent = `${count}`;
}

function toggleAnswers() {
    document
        .body
        .classList
        .toggle('answers-disabled')
}

function toggleDialog() {
    const dialog = document.querySelector('.dialog');
    dialog
        .classList
        .toggle('open');
}

// RENDERING

function render(posts) {
    const container = document.querySelector('section');
    container.innerHTML = '';
    for (const post of posts) {
        container.appendChild(postToHtmlElement(post));
    }
    initSearch();
    selectAnswers(null);
}

const html = {
    post: (post) => {
        if (!post)
            return '';
        const date = new Date(post.timestamp * 1000);
        const edate = new Date(post.edited * 1000);
        return `
        <header>
            <time datetime="${date.toISOString()}">${formatDate(date)}, ${formatTime(date)}</time>

            ${ifExists(post.subject, x => `
            <span class="subject" title="subject">${x}</span>`)}

            <span class="name" title="name">${post.name}</span>

            ${ifExists(post.trip, x => `
            <span class="trip" title="trip">${x}</span>`)}

            ${ifExists(post.email, x => `
            <span class="email" title="email">${x}</span>`)}

            ${ifExists(post.userId, x => `
            <span class="userid" title="userid">ID: ${x}</span>`)}

            <a href="${post.link}" target="_blank">${post.id}</a>

            ${ifExists(post.edited, x => `
            <span class="edited" title="${edate.toISOString()}">Last edited at ${formatDate(edate)}, ${formatTime(edate)}</span>`)}
        </header>

        ${forAll(post.images, html.img)}

        <div class="text">${addHighlights(post.text)}</div>`;
    },
    img: (image) => {
        if (!image)
            return '';
        const url = localImgSrc(image.url);
        return `<a href="${url}" target="_blank">
          ${ifExists(image.filename, x => `
          <span class="filename" title="file name">${x}</span>`)}
          <img src="${url}" class="contain" width="300" height="300">
        </a>`;
    }
};

function dateToHtmlElement(date) {
    return tag.fromString(`
    <div><time datetime="${date.toISOString()}">${formatDate(date)}</time></div>
    `);
}

function postToHtmlElement(post) {
    const element = tag.fromString(`
        <article id="post${post.id}" class="source_${post.source} ${ifExists(post.timestampDeletion, () => 'deleted')}">
          <button onclick="selectAnswers(${post.id})" class="answers ${answerButtonClass(post.id)}">answers</button>
          <span class="counter">${postOrder.indexOf(post.id) + 1}</span>
          ${forAll(post.references, x => `
          <blockquote id="post${post.id}">${html.post(x)}</blockquote>`)}
          ${html.post(post)}
        </article>`);
    element.item = post;
    return element;
}

const answerButtonClass = (postId) => editedAnswers[postId]
    ? 'edited'
    : answers[postId] && answers[postId].length
        ? ''
        : 'empty';

// 1,10925,12916,13092,13215,59684,93287,93312,14795558,14797863,147023341,14802
// 9633,148029962,148031295,148032210,148032910,148033178,148033932,148136656,14
// 7 6689362

const localImgSrc = src => 'data/images/' + src
    .split('/')
    .slice(-1)[0];

const legendPattern = new RegExp(`([^a-zA-Z])(${Object.keys(legend).join('|')})([^a-zA-Z])`, 'g');

const addHighlights = text => !text ?
    '' :
    text
        .replace(/(^>[^>].*\n?)+/g, (match) => `<q>${match}</q>`)
        .replace(/(https?:\/\/[.\w\/?\-=&#]+)/g, (match) =>
            match.endsWith('.jpg') ?
                `<img src="${match}" alt="image">` :
                `<a href="${match}" target="_blank">${match}</a>`)
        .replace(/(\[[^[]+])/g, (match) => `<strong>${match}</strong>`)
        .replace(legendPattern, (match, p1, p2, p3, o, s) => `${p1}<abbr title="${legend[p2]}">${p2}</abbr>${p3}`);

// PARSE 8chan

let emptyThreads;

function checkForNewPosts() {
    emptyThreads = [];
    statusElement.textContent = 'Fetching new posts...';

    const alreadyParsedIds = [
        // empty threads on cbts
        1,
        10,
        100321,
        100323,
        101124,
        101287,
        101840,
        102142,
        102804,
        103753,
        104552,
        104641,
        105464,
        10556,
        106,
        106285,
        106323,
        107138,
        107604,
        108000,
        108024,
        108027,
        108272,
        108873,
        109005,
        109881,
        110385,
        110721,
        110901,
        111180,
        111656,
        112573,
        113439,
        114171,
        114324,
        115178,
        115185,
        115972,
        116764,
        116784,
        117654,
        117776,
        117841,
        118462,
        119253,
        120048,
        120430,
        122424,
        123275,
        123576,
        123887,
        124167,
        124958,
        125046,
        125574,
        125725,
        125940,
        126728,
        127080,
        127436,
        127679,
        12832,
        129379,
        129902,
        130219,
        130309,
        130524,
        131416,
        131488,
        131736,
        131800,
        131837,
        132229,
        132230,
        1327,
        132899,
        133015,
        1342,
        1346,
        1362,
        1367,
        137599,
        1391,
        1398,
        1401,
        1411,
        15139,
        15577,
        15984,
        16027,
        170,
        17818,
        179249,
        1816,
        189017,
        189803,
        190713,
        191551,
        192328,
        193168,
        194037,
        194481,
        195676,
        196398,
        197248,
        198079,
        198893,
        199643,
        2,
        200536,
        201328,
        202103,
        202933,
        203759,
        204603,
        205441,
        206199,
        206957,
        20714,
        207776,
        2078,
        208626,
        209455,
        210279,
        211963,
        212207,
        212756,
        213638,
        215269,
        216046,
        216868,
        217739,
        218484,
        219376,
        2198,
        220000,
        220949,
        221756,
        2219,
        222379,
        223363,
        224195,
        224932,
        225808,
        226561,
        227400,
        228142,
        228986,
        2300,
        231428,
        232225,
        232997,
        23344,
        233716,
        233781,
        234709,
        23518,
        235487,
        236275,
        237102,
        2422,
        26613,
        28157,
        28513,
        290,
        29994,
        3102,
        3163,
        33405,
        33454,
        33706,
        3418,
        36791,
        37441,
        3952,
        40157,
        4136,
        41581,
        41855,
        42055,
        423,
        4249,
        4409,
        44295,
        44375,
        4485,
        45109,
        49767,
        49883,
        4992,
        50043,
        50429,
        52820,
        55606,
        56075,
        56328,
        56876,
        58319,
        59035,
        59512,
        5984,
        59853,
        60804,
        61078,
        61105,
        61534,
        61621,
        61918,
        62050,
        62353,
        62562,
        62673,
        62689,
        64254,
        64707,
        65108,
        6535,
        65503,
        65635,
        65909,
        66796,
        66888,
        67649,
        68564,
        69526,
        69603,
        70260,
        71064,
        71941,
        74186,
        74559,
        75329,
        76158,
        77001,
        77040,
        7705,
        77824,
        78661,
        79481,
        80329,
        80370,
        80960,
        82175,
        83064,
        84471,
        848,
        8515,
        86074,
        8629,
        86934,
        87855,
        88704,
        89588,
        90491,
        91369,
        91987,
        93785,
        94250,
        94465,
        94829,
        95429,
        96273,
        97068,
        97899,
        98535,
        99590,

        // threads already in cbtsTrip8chanPosts.js
        120902,
        121693,
        126564,
        128199,
        128973,
        129812,
        13366,
        150923,
        16943,
        33992,
        59130,
        59969,
        63405,
        69407,
        72735,
        73615,
        74470,
        81218,
        82147,
        85308,
        92197,
        93014
    ];

    const catalogUrl = 'https://8ch.net/cbts/catalog.json';

    getJson(catalogUrl).then(threads => {

        const newThreadIds = threads.reduce((p, e) => p.concat(e.threads), []).filter((p) => p.sub.includes('CBTS')).map((p) => p.no).filter((id) => !alreadyParsedIds.includes(id));

        Promise
            .all(newThreadIds.map(getPostsByThread))
            .then(result => {
                const newPosts = result.reduce((p, e) => p.concat(e), []);

                console.log(`empty threads\n${emptyThreads}`);

                newPosts.sort((a, b) => b['timestamp'] - a['timestamp']);
                posts.unshift(...newPosts);
                postOrder.push(...(newPosts.map(p => p.id).reverse()));
                render(posts);
                statusElement.textContent = '';
            });
    });
}

function getPostsByThread(id) {
    const threadUrl = (id) => `https://8ch.net/cbts/res/${id}.json`;
    const referencePattern = />>(\d+)/g;

    return getJson(threadUrl(id)).then(result => {
        if (!result.posts.some((p) => p.trip === '!UW.yye1fxo')) {
            emptyThreads.push(id);
            return [];
        }
        const threadPosts = result
            .posts
            .map(p => parse8chanPost(p, id));

        const newPosts = threadPosts.filter((p) => p.trip === '!UW.yye1fxo');

        for (const newPost of newPosts) {
            referencePattern.lastIndex = 0;
            if (referencePattern.test(newPost.text)) {
                referencePattern.lastIndex = 0;
                const referenceId = referencePattern.exec(newPost.text)[1];
                newPost.references = threadPosts.filter((p) => p.id == referenceId);
            }
        }
        console.log(`added ${newPosts.length} posts from thread ${id}`);
        return newPosts;
    });
}

function parse8chanPost(post, threadId) {
    const getImgUrl = (chanPost) => ({
        url: `https://media.8ch.net/file_store/${chanPost.tim}${chanPost.ext}`,
        filename: chanPost.filename
    });

    const keyMap = {
        'no': 'id',
        'id': 'userId',
        'time': 'timestamp',
        'title': 'title',
        'name': 'name',
        'email': 'email',
        'trip': 'trip',
        'com': 'text',
        'sub': 'subject',
        'last_modified': 'edited'
        // 'filename': 'fileName',
    };

    const newPost = {
        'images': []
    };
    for (const key of Object.keys(keyMap)) {
        if (post[key] == null)
            continue;

        if (key == 'tim')
            newPost['images'].push(getImgUrl(post));
        else if (key == 'extra_files')
            newPost['images'].push(...post[key].map(getImgUrl));
        else if (key == 'no')
            newPost[keyMap[key]] = post[key].toString();
        else if (key == 'com')
            newPost[keyMap[key]] = cleanHtmlText(post[key]);
        else
            newPost[keyMap[key]] = post[key];
    }
    newPost.source = '8chan_cbts';
    newPost.link = `https://8ch.net/cbts/res/${threadId}.html#${newPost.id}`;
    newPost.threadId = '' + threadId;
    newPost.isNew = true;
    return newPost;
}

function cleanHtmlText(htmlText) {
    const emptyPattern = /<p class="body-line empty "><\/p>/g;
    const referencePattern = /<a [^>]+>&gt;&gt;(\d+)<\/a>/g;
    const linkPattern = /<a [^>]+>(.+?)<\/a>/g;
    const quotePattern = /<p class="body-line ltr quote">&gt;(.+?)<\/p>/g;
    const paragraphPattern = /<p class="body-line ltr ">(.+?)<\/p>/g;

    return htmlText
        .replace(emptyPattern, '\n')
        .replace(referencePattern, (m, p1) => `>>${p1}`)
        .replace(linkPattern, (m, p1) => `${p1}`)
        .replace(quotePattern, (m, p1) => `>${p1}\n`)
        .replace(paragraphPattern, (m, p1) => `${p1}\n`);
}

//////////////////// html functions //////////////////

const ifElement = (selector, callback) => {
    const element = document.querySelector(selector);
    if (element)
        return callback(element);
};

function copyAnswers() {
    ifElement('article.selected', selectedArticle => {
        const postId = selectedArticle.item.postId;
        editedAnswers[postId] = editor.value();
    });

    const copyTextarea = document.querySelector('#Copy');
    copyTextarea.value = JSON.stringify(editedAnswers, null, 2);

    copyTextarea.select();
    try {
        document.execCommand('copy');
        copyTextarea.value = '';
    } catch (err) {
        alert('browser doesn\'t support copy');
    }
}

function resetAnswer() {
    ifElement('article.selected', selectedArticle => {
        const postId = selectedArticle.item.id;
        delete editedAnswers[postId];
        const value = answers[postId] || '';
        editor.value(value);
        if (editor.isPreviewActive()) {
            setPreview(editor);
        }
        selectedArticle
            .querySelector('article button')
            .className = `answers ${value
            ? ''
            : 'empty'}`;
    });
}

const answerIsEdited = postId => (!answers[postId] && editor.value().length) || (answers[postId] && answers[postId] !== editor.value());

function selectAnswers(selectedPostId) {
    ifElement('article.selected', selectedArticle => {
        const postId = selectedArticle.item.id;
        if (answerIsEdited(postId)) {
            editedAnswers[postId] = editor.value();
            selectedArticle
                .querySelector('article button')
                .className = `answers edited`
        }
        selectedArticle
            .classList
            .remove('selected');
    });
    if (!selectedPostId) {
        document
            .querySelector('aside h1')
            .innerHTML = `Answers`;
        editor.value('');
        if (editor.isPreviewActive()) {
            setPreview(editor);
        }
        document
            .querySelector('#editor-wrapper')
            .style
            .display = 'none';
    } else {
        document
            .querySelector('#editor-wrapper')
            .style
            .display = 'block';

        const article = document.querySelector(`#post${selectedPostId}`);
        article
            .classList
            .add('selected');

        document
            .querySelector('aside h1')
            .innerHTML = `Answers for <a href="#post${selectedPostId}">${selectedPostId}</a>`;

        const answer = editedAnswers[selectedPostId] !== undefined
            ? editedAnswers[selectedPostId]
            : answers[selectedPostId] || '';
        editor.value(answer);
        // refresh hack
        if (editor.isPreviewActive()) {
            setPreview(editor);
        }
    }
}

function storeLocalAnswers() {
    ifElement('article.selected', selectedArticle => {
        const postId = selectedArticle.item.id;
        editedAnswers[postId] = editor.value();
    });
    localStorage.setItem('answers', JSON.stringify(editedAnswers));
}

function loadLocalAnswers() {
    const newAnswers = localStorage.getItem('answers');
    if (newAnswers) {
        editedAnswers = JSON.parse(newAnswers);
    }
}

function setPreview(editor) {
    const wrapper = editor
        .codemirror
        .getWrapperElement();
    const toolbar = editor.options.toolbar
        ? editor.toolbarElements.preview
        : null;
    const preview = wrapper.lastChild;

    preview
        .classList
        .add("editor-preview-active");

    if (toolbar) {
        toolbar
            .classList
            .add("active");

        const toolbarDiv = wrapper.previousSibling;
        toolbarDiv
            .classList
            .add("disabled-for-preview");
    }
    preview.innerHTML = editor
        .options
        .previewRender(editor.value(), preview);
}

function getAllAnswersUpdate() {
    return JSON.stringify(Object.assign({}, answers, editedAnswers), null, 2);
}

window.addEventListener('beforeunload', storeLocalAnswers);

document.addEventListener('DOMContentLoaded', main, false);