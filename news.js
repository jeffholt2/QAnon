let news = [];
function main() {
    Promise.all([
        getLocalJson('news'),
    ]).then(values => {
        news = values[0];
        news.sort((a, b) => b.date - a.date);
        initNews(news);
        initSearch(news, document.querySelector('input[type=search]'));
    });
}

function initSearch(items, searchElement) {
    searchElement.oninput = () => {
        const terms = searchElement.value.toLowerCase().split(' ');

        const keywordInText = (term, text) => text.toLowerCase().includes(term);
        const itemContains = item => term => (item.headline && keywordInText(term, item.headline))
            || (item.description && keywordInText(term, item.description))
            || keywordInText(term, item.url);

        const ids = items
            .filter(item => terms.every(itemContains(item)))
            .map(p => p.id);

        applyFilter(ids);

        if(value === '')
            setParams({});
        else
            setParams({q: value});
    };
    const result = {};
    for (const item of items) {
        const hostname = getHostname(item.url);
        if (!result[hostname]) result[hostname] = new Set();
        result[hostname].add(item.id);
    }
    const resultList = Object.keys(result)
        .map(k => ({line: k, ids: result[k]}))
        .filter(a => a.ids.size > 2);

    resultList.sort((a, b) => b.ids.size - a.ids.size);
    const datalist = document.querySelector('#hints');
    datalist.innerHTML = resultList.map(i => `<option label="${i.ids.size}">${i.line}</option>`).join('\n');

    const query = getParams(location.search);
    if('q' in query) {
        searchElement.value = query.q;
        searchElement.oninput();
    }
}

function initNews(newsItems) {
    const container = document.querySelector('main');
    let lastDate = new Date(newsItems[0].date);
    let newsContainer = tag('section');
    container.appendChild(tag.fromString(html.date(lastDate)));
    for (const item of newsItems) {
        const newsDate = new Date(item.date);
        if (lastDate.getTime() !== newsDate.getTime()) {
            lastDate = newsDate;
            container.appendChild(newsContainer);
            container.appendChild(tag.fromString(html.date(newsDate)));
            newsContainer = tag('section');
        }
        const element = tag.fromString(html.news(item));
        element.item = item;
        newsContainer.appendChild(element);
    }
    container.appendChild(newsContainer);
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
    for(const h3 of Array.from(document.querySelectorAll('.sticky'))) {
        const section = h3.nextElementSibling;
        h3.hidden = Array.from(section.children).every(c => c.hidden);
    }
    document.querySelector('#count').textContent = `${count}`;
}

const html = {
    img: (src) => {
        if (!src) return '';
        return `<img src="${src}" class="contain" width="100" height="100">`;
    },
    date: item => {
        return `
        <h3 class="center sticky"><time datetime="${item.toISOString()}">${formatDate(item)}</time></h3>
        `;
    },
    news: item => {
        return `
        <article>
        ${ifExists(debug, x => `
        <button onclick="this.parentElement.hidden = true">✖</button>`)}
        <a href="${item.url}" target="_blank" class="row">
          <div>${ifExists(item.imageUrl, html.img)}</div>
          <div class="stretch">
            <h2>${item.headline}</h2>
            ${ifExists(item.description, x => `
            <p class="text">${x}</p>`)}
          </div>
          </a>
        <small>${getHostname(item.url)}</small>
        </article>`;
    },
};

document.addEventListener('DOMContentLoaded', main, false);