/**
 * @file
 * Contains JS functionality for displaying blocks within a region as tabs.
 */
(function (Tabby, once, Drupal) {
  'use strict';

  let searchPhrases = getSearchPhrasesFromFragment();

  let tabIdsAlreadyUsed = [];
  const generateSafeAndUniqueTabId = function(text, prefix) {
    // Text is likely user generated. Clean it up to make it suitable for use
    // as an HTML ID.
    let id =
      prefix + '-' +
      text
        .toLowerCase()
        .trim()
        .replace(/[\s\W-]+/g, '-')
        .replace(/^-+|-+$/g, '');

    // Some tabs may have the same name (especially if there's multiple tab sets
    // on the same page). Ensure we assign a unique ID to each tab by keeping
    // track of all the IDs we've used and appending a number to the end if
    // needed.
    let counter = 1;
    let uniqueifiedId = id;
    while (tabIdsAlreadyUsed.includes(uniqueifiedId)) {
      uniqueifiedId = id + '-' + counter;
      counter++;
      // Prevent unlimited loop just in case.
      if (counter > 100) {
        break;
      }
    }
    tabIdsAlreadyUsed.push(uniqueifiedId);
    return uniqueifiedId;
  };

  Drupal.behaviors.tabbed_layout_region = {
    attach: function (context, settings) {
      // Don't convert blocks to tabs if the user is in the Layout Builder
      // interface because we need to ensure the user can still clearly edit
      // each block. The tabbed interface makes that more difficult.
      if (document.querySelector('#layout-builder')) {
        return;
      }

      // Find all layout regions that were marked with our custom data attribute.
      once('tabbed_layout_region', ".layout__region[data-tabbed='1']", context).forEach(function (region, regionIndex) {
        // Keep track of the block headings we discover so we can hide them
        // after initializing the tabs.
        let blockHeadings = [];

        // Dynamically create tabs for each block in the region by pulling out
        // the block titles and using them as the tab titles.
        let tabs = document.createElement('ul');

        region.querySelectorAll('.block').forEach(function (block, blockIndex) {
          // Try and find the block heading. Our base block template assigns
          // a block-heading class, but some themes may override block template
          // and not have this. If we can't find it based on that class, we
          // look for the first h2 and use that.
          let tabTitle = '[Missing Block Title]';
          let blockHeading = block.querySelector('.block-heading');
          if (!blockHeading) {
            blockHeading = block.querySelector('h2');
          }
          if (blockHeading) {
            tabTitle = blockHeading.textContent;
            blockHeadings.push(blockHeading);
          }

          const tabId = generateSafeAndUniqueTabId(tabTitle, 'tab');
          let linkElement = document.createElement('a');
          linkElement.href = '#' + tabId;
          linkElement.innerHTML = tabTitle;
          let listItemElement = document.createElement('li');
          listItemElement.appendChild(linkElement);
          tabs.appendChild(listItemElement);

          // Assign ID to the block div so it's associated with the tab.
          block.id = tabId;
          block.classList.add('tabby-panel');
        });

        // If more than one tab has been created, then initiate the tab plugin.
        if (tabs.querySelectorAll('li').length >= 2) {
          // Don't need to show the block titles anymore, since they are shown
          // as tab titles.
          blockHeadings.forEach(blockHeading => {
            blockHeading.classList.add('sr-only');
            blockHeading.insertAdjacentText('afterbegin', 'Tab panel: ');
          });

          // Prepend the tab navigation to the region.
          const heading = document.createElement('h2');
          heading.textContent = `Tab List ${regionIndex + 1}`;
          heading.classList.add('sr-only');
          region.prepend(tabs);
          region.prepend(heading);

          // Initialize Tabby. Indicate the first tab should be selected
          // by default.
          tabs.querySelector('li:first-child a').setAttribute('data-tabby-default', '');

          // Allows accessing API programmatically from element.
          region.tabby = new Tabby(tabs);

          // Add any clicked tab IDs to the URL as a fragment so that someone
          // can easily share the clicked tab contents with someone else.
          document.addEventListener('tabby', function (event) {
            window.history.replaceState({}, '', '#' + event.detail.content.id);
          });

          // If user arrived from search, check if any tab contents
          // contain the keywords and reveal that tab to make it easier for
          // user to find what they searched for.
          // We cannot reveal all tabs at once if multiple contains keywords,
          // so we stop after we match one.
          let tabToShow = -1;
          searchPhrases.forEach(function (searchPhrase) {
            let regex = new RegExp('\\b' + searchPhrase + '\\b', 'i');
            if (tabToShow > -1) {
              return;
            }
            // First look at the tab titles.
            const tabTitles = region.querySelectorAll('.tabby-menu__nav-wrapper li a');
            for (let i = 0; i < tabTitles.length; i++) {
              if (regex.test(tabTitles[i].textContent)) {
                tabToShow = i;
                break;
              }
            }
            // Then the tab contents.
            const tabPanels = region.querySelectorAll("[role='tabpanel']");
            for (let i = 0; i < tabPanels.length; i++) {
              // Get the text of the tab content. If we just asked for
              // the entire tag's textContent, paragraph elements get smushed
              // together without a space, so our regex that tests on word
              // boundaries fails. So we find each paragraph and get their text
              // and combine them with a space.
              const tabText = Array.from(tabPanels[i].querySelectorAll('p'))
                .map(p => p.textContent.trim())
                .join(' ');
              if (regex.test(tabText)) {
                tabToShow = i;
                break;
              }
            }
          });
          if (tabToShow > -1) {
            // Delay showing the tab. We need to give Tabby.js time to add
            // click handlers.
            setTimeout(function () {
              const tabs = region.querySelectorAll('.tabby-menu__nav-wrapper li a');
              if (tabs[tabToShow]) {
                tabs[tabToShow].click();
              }
            }, 500);
          }
        }
      });
    }
  };
}(Tabby, once, Drupal));
