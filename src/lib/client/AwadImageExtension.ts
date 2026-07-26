import Image from '@tiptap/extension-image';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { uploadImage } from './media';

export const AwadImageExtension = Image.extend({
	name: 'awadImage',

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey('awadImageUploadHandler'),
				props: {
					handleDOMEvents: {
						drop(view, event) {
							const hasFiles =
								event.dataTransfer &&
								event.dataTransfer.files &&
								event.dataTransfer.files.length > 0;

							if (!hasFiles) return false;

							const file = event.dataTransfer!.files[0];
							if (!file.type.startsWith('image/')) return false;

							event.preventDefault();

							// Insert optimistic blob preview URL
							const placeholderUrl = URL.createObjectURL(file);
							const { schema } = view.state;
							const coordinates = view.posAtCoords({
								left: event.clientX,
								top: event.clientY
							});

							const node = schema.nodes.image.create({
								src: placeholderUrl,
								alt: 'Uploading image...'
							});

							const tr = view.state.tr.insert(coordinates?.pos || view.state.selection.from, node);
							view.dispatch(tr);

							// Execute Phase 1 & Phase 2 (skipping Phase 3 commit)
							uploadImage(file, 'article_inline', { commit: false })
								.then(({ cdn_url }) => {
									// Replace placeholder with permanent CDN URL
									view.state.doc.descendants((n, pos) => {
										if (n.type.name === 'image' && n.attrs.src === placeholderUrl) {
											const updateTr = view.state.tr.setNodeMarkup(pos, undefined, {
												...n.attrs,
												src: cdn_url,
												alt: file.name
											});
											view.dispatch(updateTr);
										}
									});
									URL.revokeObjectURL(placeholderUrl);
								})
								.catch((err) => {
									console.error('Tiptap image upload error:', err);
									alert(`Upload failed: ${err.message || err}`);
								});

							return true;
						},

						paste(view, event) {
							const items = Array.from(event.clipboardData?.items || []);
							const imageItem = items.find((item) => item.type.startsWith('image/'));

							if (!imageItem) return false;

							const file = imageItem.getAsFile();
							if (!file) return false;

							event.preventDefault();

							const placeholderUrl = URL.createObjectURL(file);
							const { schema } = view.state;

							const node = schema.nodes.image.create({
								src: placeholderUrl,
								alt: 'Uploading pasted image...'
							});

							const tr = view.state.tr.replaceSelectionWith(node);
							view.dispatch(tr);

							// Execute Phase 1 & Phase 2
							uploadImage(file, 'article_inline', { commit: false })
								.then(({ cdn_url }) => {
									view.state.doc.descendants((n, pos) => {
										if (n.type.name === 'image' && n.attrs.src === placeholderUrl) {
											const updateTr = view.state.tr.setNodeMarkup(pos, undefined, {
												...n.attrs,
												src: cdn_url,
												alt: file.name
											});
											view.dispatch(updateTr);
										}
									});
									URL.revokeObjectURL(placeholderUrl);
								})
								.catch((err) => {
									console.error('Tiptap image paste upload error:', err);
									alert(`Upload failed: ${err.message || err}`);
								});

							return true;
						}
					}
				}
			})
		];
	}
});
