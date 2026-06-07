/**
 * @file
 * Contains JS functionality for random image loading for an Image block.
 */

(function ($, Drupal, once) {
  'use strict';

  Drupal.behaviors.random_image = {
    attach: function (context, settings) {

      $(once('ps-random-image', '.block-ps-image', context)).each(function () {
        let $figures = $(this).find('figure.random-image');
        const randomIndex = Math.floor(Math.random() * $figures.length);
        $figures.each(function (index) {
          // Reveal a random image and remove others.
          if (index === randomIndex) {
            $(this).removeClass('invisible')
              .removeAttr('aria-hidden')
              .removeAttr('tabindex');
            let $image = $('img', this);
            if ($image.length) {
              const dataSrc = $($image).attr('data-src');
              if (dataSrc) {
                let safeSrc = '';
                try {
                  let parsed = new URL(dataSrc, window.location.href);
                  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                    safeSrc = parsed.href;
                  }
                } catch (e) {
                  if (!dataSrc.includes(':')) {
                    safeSrc = dataSrc;
                  }
                }
                if (safeSrc) {
                  $($image).attr('src', safeSrc);
                }
              }
              const dataSrcSet = $($image).attr('data-srcset');
              if (dataSrcSet) {
                let safeSrcSet = '';
                try {
                  let parsed = new URL(dataSrcSet, window.location.href);
                  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                    safeSrcSet = parsed.href;
                  }
                } catch (e) {
                  if (!dataSrcSet.includes(':')) {
                    safeSrcSet = dataSrcSet;
                  }
                }
                if (safeSrcSet) {
                  $($image).attr('srcset', safeSrcSet);
                }
              }
            }
          }
          else {
            $(this).remove();
          }
        });
      });
    }
  };

}(jQuery, Drupal, once));
