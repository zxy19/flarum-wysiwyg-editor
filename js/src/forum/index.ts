import app from 'flarum/forum/app';
import applyEditor from './applyEditor';
import { preprocessTags } from './util/templateReplaceUtil';

app.initializers.add('foskym/flarum-wysiwyg-editor', () => {
  preprocessTags();
  preprocessTags();
  applyEditor();
});
