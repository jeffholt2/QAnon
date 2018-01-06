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
        getLocalJson('answers'),
        getLocalJson('pol4chanPosts'),
        getLocalJson('polTrip8chanPosts'),
        getLocalJson('cbtsNonTrip8chanPosts'),
        getLocalJson('cbtsTrip8chanPosts'),
        getLocalJson('thestormTrip8chanPosts'),
    ]).then(values => {
        answers = values[0];
        posts = [].concat(values[1]).concat(values[2]).concat(values[3]).concat(values[4]).concat(values[5]);
        posts.sort((a, b) => b.timestamp - a.timestamp);
        postOrder.push(...(posts.map(p => p.id).reverse()));

        render(posts);
        loadLocalAnswers();
        checkForNewPosts();
    });

    toggleAnswers();
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

    const alreadyParsedIds = Array.from(new Set(posts.map(p => parseInt(p.threadId)))).concat(
        []
    );
    console.log(alreadyParsedIds);

    const catalogUrl = 'https://8ch.net/thestorm/catalog.json';

    getJson(catalogUrl).then(threads => {

        const allThreadIds = threads
            .reduce((p, e) => p.concat(e.threads), [])
            .filter((p) => p.sub.includes('CBTS'))
            .map((p) => p.no);
        console.log(allThreadIds);
        const newThreadIds = allThreadIds
            .filter((id) => !alreadyParsedIds.includes(id));
        console.log(newThreadIds);

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
        const threadPosts = result.posts.map(parse8chanPost);

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

function parse8chanPost(post) {
    const getImgUrl = (chanPost) => ({
        url: `https://media.8ch.net/file_store/${chanPost.tim}${chanPost.ext}`,
        filename: chanPost.filename
    });
    return {
        images: post.tim ? [getImgUrl(post)] : [],
        id: post.no.toString(),
        userId: post.id,
        timestamp: post.time,
        title: post.title,
        name: post.name,
        email: post.email,
        trip: post.trip,
        text: cleanHtmlText(post.com),
        subject: post.sub,
        source: '8chan_thestorm',
        link: `https://8ch.net/thestorm/res/${post.resto}.html#${post.no}`,
        threadId: post.resto.toString(),
        isNew: true,
    };
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