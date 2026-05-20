/**
 * @file
 * Contains JS functionality for dynamically creating a sticky jump link menu.
 */

(function ($, Drupal, drupalSettings, once) {
  'use strict';

  Drupal.behaviors.jump_link_menu = {
    attach: function (context, settings) {
      $(once('jump-link-menu', '.jump-link-menu', context)).each(function () {
        let $jumpLinkMenuContainer = $(this);

        // Only slide animate if user has not requested reducing motion.
        const animationDuration = window.matchMedia("(prefers-reduced-motion)").matches ? 1 : '';

        // We support two methods for informing what to use to populate the
        // jump link menu.
        // If a specific CSS selector was specified, we use that to search for
        // and identify all the jump link anchors to build the menu from. With
        // this method, we assume that the HTML element has a unique ID and
        // a jump link title specified as a data attribute.
        // If no CSS selector was specified, we fall back to scanning for all
        // level 2 headings on the page and using those.
        let jumpLinkMenuItems = [];
        if (drupalSettings.ps_jump_link_menu && drupalSettings.ps_jump_link_menu.anchor_selector) {
          let $existingJumpLinkAnchors = $(document).find(drupalSettings.ps_jump_link_menu.anchor_selector);
          if ($existingJumpLinkAnchors.length > 0) {
            $existingJumpLinkAnchors.each(function () {
              let itemTitle = $(this).data('jump-link-title');
              let itemId = $(this).attr('id');
              if (itemTitle && itemId) {
                jumpLinkMenuItems.push({
                  label: itemTitle,
                  fragment: itemId
                });
              }
            });
          }
        }
        else {
          // Collect the list of jumplinks to create by parsing all the h2
          // elements in the content region.
          let $headings = $('.region-content h2:not(.visually-hidden, .sr-only, .jump-link-title, .fc-toolbar-title):visible', context);
          let anchors = [];
          $headings.each(function (i, heading) {
            // Use header text as fragment name. Replace space or other special
            // characters with a hyphen. There's more we could do here to make
            // them nicer looking, but at this point there could be links in the
            // wild using the old hashs and we don't want to break them.
            let anchorId = $(this).text().replace(/[^a-zA-Z0-9]/g, '-');

            // Valid IDs cannot start with a number.
            if (!isNaN(anchorId.charAt(0))) {
              anchorId = '_' + anchorId;
            }

            // Make sure fragment is unique.
            if (anchors.indexOf(anchorId) > -1) {
              anchorId = anchorId + '-' + (i + 1);
            }

            anchors.push(anchorId);

            // Place an anchor inside the heading element.
            // It has a special CSS class used to add a buffer area to the top
            // of the element to account for sites with a sticky header.
            let $anchor = $('<span/>')
              .attr('id', anchorId)
              .attr('class', 'jump-link-anchor');
            $(this).prepend($anchor);

            jumpLinkMenuItems.push({
              label: $(this).text(),
              fragment: anchorId
            });
          });
        }

        // No sense in creating the menu if there's not at least 2 items.
        if (jumpLinkMenuItems.length > 1) {
          let $jumpLinkMenu = $('.nav', $jumpLinkMenuContainer);
          let $jumpLinkMenuDropdown = $('.jump-link-menu__dropdown-nav', $jumpLinkMenuContainer);
          let $jumpLinkDropdownToggle = $('.jump-link-menu__open-dropdown', $jumpLinkMenuContainer);
          let isSubnavOpened = false;
          jumpLinkMenuItems.forEach(function (jumpLinkData) {
            let $listLink = $('<a class="nav-link"></a>').attr('href', '#' + jumpLinkData.fragment).text(jumpLinkData.label);
            let $listItem = $('<li class="nav-item"></li>');
            $listItem.append($listLink);
            $jumpLinkMenuDropdown.append($listItem.clone());
            $jumpLinkMenu.append($listItem);
          });

          // Populate the dropdown menu with the same set of links. This is
          // used for easier nav on mobile.
          let $dropdownWrapper = $('.jump-link-menu__dropdown', $jumpLinkMenuContainer);
          $dropdownWrapper.append($jumpLinkMenuDropdown);

          // Now that the menu is populated, show it, since it was hidden by
          // default in CSS.
          $jumpLinkMenuContainer.show();
          $('.jump-link-menu__wrapper').addClass('show');

          // We will use Bootstrap's scrollspy plugin to automatically add an active
          // class to the jump link menu item when it scrolls into view.
          // We delay this by a bit to give the admin menu time to initialize since
          // we need to consider its final height.
          let waitForAdmin = $('#toolbar-administration').length > 0 ? 1500 : 150;
          let stickyHeaderOffset = 0;
          setTimeout(function () {
            // Obtain the sticky header  offset from CSS, which already has
            // a fairly accurate measurement based on the presence of various
            // sticky elements. If the CSS property isn't supported (Safari 14
            // and older and IE), then calculate it using JS. This is not ideal
            // because it prevents themes from overridding the default values
            // we have for the heights if they need to.
            if ('CSS' in window && CSS.supports('scroll-margin-top', '0')) {
              let $jumpLinkAnchor = $('.jump-link-anchor').first();
              if ($jumpLinkAnchor.length && $jumpLinkAnchor.css('scroll-margin-top')) {
                stickyHeaderOffset = parseInt($jumpLinkAnchor.css('scroll-margin-top'));
              }
            }
            else {
              // This special number is just under the EM value for our large
              // breakpoint. Taken from our main-menu.js while does a similar
              // calculation. Why it's not exactly at the number I'm not sure,
              // but John used this specific number for a reason originally.
              let inLargeBreakpoint = psWindowEmWidth() > 61.9375;
              let $body = $('body');
              if ($body.hasClass('toolbar-fixed')) {
                stickyHeaderOffset += 39;
                // Toolbar is taller in larger breakpoints.
                if (inLargeBreakpoint) {
                  stickyHeaderOffset += 39;
                }
              }
              // Add height of sticky header.
              if ($body.hasClass('sticky-main-menu')) {
                stickyHeaderOffset += 76;
                // Sticky header is taller in larger breakpoints.
                if (inLargeBreakpoint) {
                  stickyHeaderOffset += 51;
                }
              }
              // Add the height of the horizontal jump link menu.
              if ($body.hasClass('with-horizontal-jlm')) {
                stickyHeaderOffset += 60;
              }
            }

            // Activate the bootstrap scrollspy plugin so that the jump link
            // menu gets active item classes applied as they are scrolled into
            // view.
            // We add some extra to the offset here which allows scrollspy to
            // better detect when the user has scrolled the anchor into view.
            // Without this, sometimes it thinks the user is in the previous
            // anchor.
            let prevScroll = 0;
            if ($.fn.scrollspy) {
              $(once('scrollspy', 'body')).scrollspy({
                target: '.jump-link-menu',
                offset: stickyHeaderOffset + 15,
              });
              document.addEventListener('debouncedScroll', function() {
                // If we are scrolling up and near the top, reset menu.
                if (window.scrollY < 50 && prevScroll > 49) {
                  $jumpLinkMenu[0].scrollLeft = 0;
                }
                prevScroll = window.scrollY;
              }, false);
            }
          }, waitForAdmin);

          // Add a click handler to introduce smooth scrolling to the jumplinks.
          $jumpLinkMenuContainer.find('a.nav-link').on('click', function (e) {
            e.preventDefault();
            let href = this.href;
            let jumpId = $(this).attr('href');
            // Make sure the target element exists before scrolling to it.
            let $target = $(jumpId);
            if ($target.length > 0) {
              $target[0].setAttribute('tabindex', '0');
              // Don't scroll exactly to the anchor since it may be hidden
              // behind sticky menus. Subtract that offset we calculated above.
              let scrollTop = $(jumpId).offset().top - stickyHeaderOffset;
              $('body, html').animate({ scrollTop: scrollTop }, animationDuration, function () {
                // Set the URL to the original link and hash that were clicked
                // without affecting scroll or history. If we set
                // window.location.hash instead, it would force a scroll there
                // and it will be a slightly different position than we
                // scrolled to and it will cause a minor jump.
                history.replaceState({}, '', href);
                // Transfer focus to target.
                $target[0].focus();
              });
              window.setTimeout(function () {
                // Sometimes the doc can't scroll far enough for scrollSpy.
                e.target.closest('ul').querySelector('.active')?.classList.remove('active');
                e.target.classList.add('active');
                toggleMenu();
              }, 100, e);
            }
          });

          const toggleMenu = function () {
            let nav = $jumpLinkDropdownToggle.siblings('.jump-link-menu__dropdown-nav');
            nav.slideToggle(animationDuration);
            $jumpLinkDropdownToggle[0].setAttribute('aria-expanded', !isSubnavOpened);
            isSubnavOpened = !isSubnavOpened;
          };

          $jumpLinkDropdownToggle.on('click', function () {
            toggleMenu();
          });

          /*
           * Select vertical, horizontal or drop based on widths.
           */
          // Store booleans to reduce math on resize.
          let sideBarMenu = !!$jumpLinkMenuContainer.closest('.sidebar-first').length;
          let sideBarMoved = false;
          const controlsOnResize = () => {
            let windowWidth = psWindowEmWidth();
            if (sideBarMenu) {
              if (!sideBarMoved) {
                if (windowWidth > 61.9375) {
                  // Above this width, theme displays menu as vertical with no controls.
                  // If we are still displaying as default, we are done.
                  return;
                } else {
                  // Theme has hidden the sidebar and we need to move the menu to <main>.
                  sideBarMoved = true;
                  $('main, #main').first().prepend($jumpLinkMenuContainer);
                  $jumpLinkMenuContainer.addClass('jump-link-menu-horizontal');
                }
              } else if (windowWidth > 61.9375) {
                // Put previously moved menu back in sidebar if browser window is in large breakpoint now.
                sideBarMoved = false;
                $('.sidebar-first').append($jumpLinkMenuContainer);
                $jumpLinkMenuContainer.removeClass('jump-link-menu-horizontal');
              }
            }

            // Calculate if the largest item will fit horizontally
            let maxWidth = 0;
            let $links = $jumpLinkMenu.find('a');
            $links.each(function() {
              maxWidth = Math.max(maxWidth, this.clientWidth);
            })
            let arrowButtonWidth = 2 * parseFloat(psEmSize());
            let menuWidth = $jumpLinkMenu[0].clientWidth;
            // In mobile mode the menu reads as 0 width.
            menuWidth = menuWidth === 0 ? $jumpLinkMenuContainer[0].clientWidth - $jumpLinkDropdownToggle[0].clientWidth : menuWidth;
            // Switch if we are at mobile breakpoint or the largest item does not fit.
            if ((!sideBarMenu || (sideBarMoved)) && (windowWidth < 36 || menuWidth - maxWidth - arrowButtonWidth < 0)) {
              $jumpLinkMenuContainer.addClass('jump-link-menu-overflow');
            } else {
              $jumpLinkMenuContainer.removeClass('jump-link-menu-overflow');
              // Hide arrows/controls if there aren't any overflows.
              if ($jumpLinkMenu[0].scrollLeft === 0 && ((menuWidth + $jumpLinkMenu[0].scrollLeft) === $jumpLinkMenu[0].scrollWidth)) {
                $jumpLinkMenuContainer.addClass('no-arrows');
              }
              else {
                $jumpLinkMenuContainer.removeClass('no-arrows');
              }
            }
          };

          const arrowsOnScroll = () => {
            // Always call after controlsOnResize, as it changes this class based on breakpoint.
            let isVerticalJumpLinkMenu = $jumpLinkMenuContainer.hasClass('jump-link-menu-horizontal');
            if (!isVerticalJumpLinkMenu || $jumpLinkMenu[0].scrollLeft === 0) {
              $('.jump-link-menu__nav-left').hide();
            }
            else {
              $('.jump-link-menu__nav-left').show();
            }
            // Extra 2px handles rounding errors.
            if (!isVerticalJumpLinkMenu || ($jumpLinkMenu[0].clientWidth + $jumpLinkMenu[0].scrollLeft) >= $jumpLinkMenu[0].scrollWidth - 2) {
              $('.jump-link-menu__nav-right').hide();
            }
            else {
              $('.jump-link-menu__nav-right').show();
            }
          };

          window.setTimeout(function() {
            controlsOnResize();
            arrowsOnScroll();
          }, 100)
          window.onresize = function () {
            controlsOnResize();
            arrowsOnScroll();
          };

          let menuItemCenterOffset = function( item ) {
            let menuWidth = $jumpLinkMenu[0].clientWidth;
            let menuItemWidth = item.clientWidth;
            let arrowButtonWidth = 2 * parseFloat(psEmSize());
            if (item && menuItemWidth + ( 2 * arrowButtonWidth ) < menuWidth) {
              scrollTo = item.offsetLeft + arrowButtonWidth - ((menuWidth - menuItemWidth) / 2);
            } else {
              scrollTo = item.offsetLeft - arrowButtonWidth;
            }
            return scrollTo;
          }

          // Scroll to active item; include a debounce for race conditions.
          let lastActivated = Date.now();
          let debouncedScroll = function() {
            let $activeMenuItem = $('.nav-link.active', $jumpLinkMenu);
            let scrollTo = 0;
            if ($activeMenuItem.length > 0) {
              // Scroll active menu item into view.
              scrollTo = menuItemCenterOffset($activeMenuItem[0]);
            }
            $jumpLinkMenu.animate({ scrollLeft: scrollTo }, animationDuration);
          }
          $(window).on('activate.bs.scrollspy', function () {
            let timesUp = Date.now() - lastActivated > 250;
            if (timesUp) {
              window.setTimeout( function() {
                debouncedScroll();
              }, 250)
              lastActivated = Date.now();
            }
          });

          $jumpLinkMenu.scroll(function () {
            arrowsOnScroll();
          });

          $('.jump-link-menu__nav-left button').on('click', function () {

            // Head off on-load race condition.
            lastActivated = Date.now();

            // Find the link that intersects the LEFT edge AND will fit without being covered by arrows.
            let links = $jumpLinkMenu.find('a');
            let push = 0;
            let prevWidth = false;
            let arrowButtonWidth = 2.5 * parseFloat(psEmSize());
            $(links.get().reverse()).each(function () {
              if (push === 0) {
                if ($jumpLinkMenu[0].scrollLeft >= this.offsetLeft + arrowButtonWidth && this.clientWidth <= $jumpLinkMenu[0].clientWidth) {
                  push = this.offsetLeft - arrowButtonWidth;
                  prevWidth = this.clientWidth;
                }
              } else if (prevWidth) {
                // Go one further to see if the next item fits too.
                if (this.clientWidth + prevWidth + (2 * arrowButtonWidth ) <= $jumpLinkMenu[0].clientWidth) {
                  push = this.offsetLeft - arrowButtonWidth;
                }
                prevWidth = false;
              }
            });

            if (push === 0) {
              // if nothing fit, fall back to 70% of the viewport width.
              push = $jumpLinkMenu[0].scrollLeft - $jumpLinkMenuContainer[0].clientWidth * .7;
            }
            $jumpLinkMenu.animate({ scrollLeft: push }, animationDuration);
            arrowsOnScroll();
          });

          $('.jump-link-menu__nav-right button').on('click', function () {

            // Head off on-load race condition.
            lastActivated = Date.now();

            // Find the first link that intersects the RIGHT edge AND will fit.
            let links = $jumpLinkMenu.find('a');
            let push = 0;
            links.each(function () {
              if (push === 0 && this.offsetLeft + this.clientWidth >= $jumpLinkMenu[0].scrollLeft + $jumpLinkMenu[0].clientWidth && this.clientWidth <= $jumpLinkMenu[0].clientWidth) {
                // Push it to align with the LEFT edge.
                push = this.offsetLeft - 45; // Leaves room for arrow.
              }
            }
            );

            if (push === 0) {
              // if nothing fit, fall back to 70% of the viewport width.
              push = $jumpLinkMenu[0].scrollLeft + $jumpLinkMenuContainer[0].clientWidth * .7;
            }

            $jumpLinkMenu.animate({ scrollLeft: push }, animationDuration);

            window.setTimeout( function() {
              arrowsOnScroll();
            }, 250)
          });
        }

      });
    }
  };

}(jQuery, Drupal, drupalSettings, once));
