import * as fs from 'fs';
import * as gettextParser from 'gettext-parser';
import {
  Comment,
  Entry,
  GroupComment,
  Junk,
  Message,
  parse,
  Pattern,
  Term,
  TextElement,
} from '@fluent/syntax';
import { GetTextTranslation } from 'gettext-parser';

type Po2Ftl = (poFilePath: fs.PathLike) => (ftlFilePath: fs.PathLike) => string;
type PoTranslations = { [msgId: string]: GetTextTranslation };

const newLines = (prev: Entry | Junk) => (next: Entry | Junk) => {
  const ended = prev.span?.end;
  const start = next.span?.start;

  if (start && ended) {
    return '\n'.repeat(start - ended);
  }

  return '\n';
};

const findLocalizedMsgStr = (v: Pattern | null) => (
  translations: PoTranslations
) => {
  if (!v) {
    return '';
  }

  // Only handle simple string with no placeables
  if (v.elements.length === 1 && (v.elements[0] as TextElement).value) {
    const msgid = (v.elements[0] as TextElement).value.replace('\n', ' ');
    const msg = translations[msgid];
    const localized = msg && msg['msgstr'] ? msg['msgstr'] : '';
    return localized;
  }

  return '';
};

const onMessage = (message: Message) => (translations: PoTranslations) => {
  const hasAttributes = message.attributes && message.attributes.length;
  const localizedMsg = findLocalizedMsgStr(message.value)(translations);

  if (!localizedMsg && !hasAttributes) {
    return '';
  }

  const ftlMessage: string[] = [];

  if (message.comment) {
    ftlMessage.push(`# ${message.comment.content}`);
  }

  ftlMessage.push(`${message.id.name} = ${localizedMsg}`);

  const ftlAttributes: string[] = [];

  if (hasAttributes) {
    message.attributes.forEach((attr) => {
      const localized = findLocalizedMsgStr(attr.value)(translations);
      if (localized) {
        ftlAttributes.push(`  .${attr.id.name} = ${localized}`);
      }
    });
  }

  if (!localizedMsg && !ftlAttributes.length) {
    return '';
  }

  ftlMessage.concat(ftlAttributes);

  return ftlMessage.join('\n');
};

const onTerm = (term: Term) => (translations: PoTranslations) => '';
const onComment = (comment: Comment) => '';
const onGroupComment = (gc: GroupComment) => '';

export const po2ftl: Po2Ftl = (poFilePath) => (ftlFilePath) => {
  const srcPo = fs.readFileSync(poFilePath);
  const parsedPo = gettextParser.po.parse(srcPo);
  const translations = parsedPo.translations[''];
  const srcFtl = fs.readFileSync(ftlFilePath);
  const parsedFtl = parse(srcFtl.toString(), {});
  const converted: string[] = [];

  parsedFtl.body.forEach((x: Entry | Junk, idx: number) => {
    switch (x.type) {
      case 'Message':
        converted.push(onMessage(x as Message)(translations));
        break;
      case 'Term':
        // TODO
        break;
      case 'Comment':
        // TODO
        break;
      case 'GroupComment':
        // TODO
        break;
      default:
        console.error(`Unhandled Fluent type ${x.type}, bailing...`);
        process.exit(1);
    }

    if (idx < parsedFtl.body.length - 1) {
      converted.push(newLines(x)(parsedFtl.body[idx + 1]));
    }
  });

  return converted.join('');
};
