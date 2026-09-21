/** Local UX review only. Every /api request terminates here; only non-API GET/HEAD assets/pages proxy to127.0.0.1:3000. */
import http from 'node:http';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.REVIEW_PORT || 3001);
const roleArg = process.argv.find(arg => arg.startsWith('--role='))?.split('=')[1] || 'teacher';
if (!['teacher', 'student'].includes(roleArg)) throw new Error('Use --role=teacher or --role=student');
const teacherEmail = 'teacher@example.test';
const studentEmail = 'review@example.test';
const iso = (days = 0) => new Date(Date.now() + days * 86_400_000).toISOString();
const art = id => `/__review/art/${id}.svg`;
const imageSVG = id => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="${['#17132a','#0f2830','#301825'][id % 3]}"/><circle cx="760" cy="360" r="260" fill="${['#8b5cf6','#14b8a6','#f97316'][id % 3]}"/><path d="M100 740 520 120 900 740Z" fill="none" stroke="#f5dba6" stroke-width="28"/><text x="70" y="100" fill="white" font-family="sans-serif" font-size="44">MINDVERSE · REVIEW ${id}</text><text x="70" y="840" fill="#cbd5e1" font-family="sans-serif" font-size="28">LOCAL FIXTURE — DESIGN PRACTICE</text></svg>`;

function seed() {
  const names = ['Туршилтын сурагч','Марал','Тэмүүлэн','Номин','Энхжин','Билгүүн','Саруул','Хулан','Төгөлдөр','Ану','Мөнхжин','Эгшиглэн'];
  const users = names.map((name, i) => ({email: i ? `student${i}@example.test` : studentEmail, name, nickname: i ? name : 'Review Student', role:'student', grade:['9','10','11','12'][i % 4], experience:[680,1820,1240,890,470,220,90,45,135,560,1020,0][i], bio:'Туршилтын өгөгдөл. Дизайн, өнгө, шинэ санаанд дуртай.', avatarUrl:art(i+1), avatarColor:'#8b5cf6'}));
  users.push({email:teacherEmail,name:'Туршилтын багш',nickname:'Review Teacher',role:'teacher',experience:0,grade:'10',bio:'Зөвхөн local UX шалгалтад зориулсан багш.',avatarUrl:art(0),avatarColor:'#14b8a6'});
  const posts = Array.from({length:14},(_,i)=>({id:`review-post-${i+1}`,title:['Өнгө ба дүрсний судалгаа','Хотын хэмнэл','Миний анхны постер'][i%3],description:'Энэ бол зөвхөн харагдац, харилцан үйлдлийг шалгах туршилтын бүтээл. Гарчиг, хоосон зай, өнгийн ялгарал дээр ажиллалаа.',author:users[i%users.length].nickname,authorEmail:users[i%users.length].email,authorGrade:users[i%users.length].grade,authorAvatarUrl:art(i+1),imageUrl:art(i+1),createdAt:new Date(Date.now()-i*3_600_000).toISOString(),visibility:'PUBLIC',points:i%4,commentCount:1,reactions:[],comments:[]}));
  const lessons = [{id:'review-lesson',title:'Өнгөний зохицол ба визуал шатлал',description:'Гол мэдээллийг тодруулж, хоёр өнгөөр постер бүтээх дадлага. Эхлээд богино асуултаа хариулаад, дараа нь өөрийн бүтээлийг илгээнэ үү.',authorEmail:teacherEmail,authorName:'Туршилтын багш',published:true,targetGrades:['9','10','11','12'],createdAt:iso(-3),updatedAt:iso(-1),questions:[{id:'q1',question:'Гарчгийг хамгийн түрүүнд анзаарагдуулахад аль шийдэл туслах вэ?',options:['Бүх текстийг ижил хэмжээтэй болгох','Гарчгийн хэмжээ, ялгарлыг нэмэх','Текст бүрт өөр фонт хэрэглэх'],correctAnswer:1,explanation:'Хэмжээ ба ялгарал мэдээллийн шатлалыг бий болгоно.'},{id:'q2',question:'Хоосон зай ямар үүрэгтэй вэ?',options:['Уншихад амар болгоно','Зөвхөн хуудсыг дүүргэнэ'],correctAnswer:0,explanation:'Хоосон зай нь мэдээллийг бүлэглэж уншихад тусална.'}],files:[{id:'review-file',fileName:'design-reference.svg',fileType:'image/svg+xml',fileUrl:art(2),fileSize:650}],submissions:[{id:'review-submission',lessonId:'review-lesson',studentEmail:'student1@example.test',studentName:'Марал',fileUrl:art(3),fileUrls:[art(3),art(4)],submittedAt:iso(-1)}]}];
  const contests = ['active','upcoming','ended'].map((status,i)=>({id:`review-contest${i ? `-${i+1}` : ''}`,title:['Хотын ирээдүй — постер уралдаан','Ногоон брэнд — лого сорилт','Typography challenge'][i],description:'Шинэ санаагаа нэг хүчтэй дүрслэлээр илэрхийл. Өнгө, найруулга болон уншигдах байдлыг үнэлнэ.',authorEmail:teacherEmail,authorName:'Туршилтын багш',startDate:iso(status==='upcoming'?3:-7),endDate:iso(status==='ended'?-1:10),prize:150,targetGrades:[],status,participants:['student1@example.test'],createdAt:iso(-8),submissions:[{id:`review-contest-sub-${i}`,contestId:'review-contest',userEmail:'student1@example.test',userName:'Марал',fileUrl:art(i+5),description:'Энгийн дүрс, тод өнгөөр хотоо дүрслэв.',votes:['student2@example.test'],submittedAt:iso(-2)}]}));
  return {users,posts,lessons,contests,comments:[{id:'review-comment',postId:'review-post-1',authorEmail:'student1@example.test',authorName:'Марал',author:'Марал',content:'Өнгийн зохицол болон том гарчиг нь их ойлгомжтой харагдаж байна.',createdAt:iso(-1),isAI:false}],options:[{text:'Өнгөний сорилт',email:teacherEmail},{text:'15 минутын скетч',email:teacherEmail},{text:'Хосоороо постер хийх',email:teacherEmail}],notifications:[{id:'review-notification',userEmail:studentEmail,actorEmail:teacherEmail,type:'LESSON',message:'Шинэ хичээл: Өнгөний зохицол ба визуал шатлал',createdAt:iso(-1),read:false}],game:{images:[1,2].map(i=>({id:`review-game-${i}`,imageUrl:art(i),imageUrls:[art(i),art(i+2)],addedBy:`student${i}@example.test`,studentName:names[i],studentNickname:names[i],likes:i,likedBy:[],createdAt:iso(-1)})),gameEnded:false,winner:null,rankings:[],lessonId:'review-lesson',targetGrade:'10'}};
}

export function createReviewServer(defaultRole = roleArg) {
  let data = seed();
  const failures = new Map();
  const stats = {proxiedPages:0,handledApi:0,blockedApi:0,mutations:0};
  function json(res, value, status=200, headers={}) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Mindverse-Review':'fixture-only',...headers});res.end(JSON.stringify(value));}
  const server = http.createServer(async(req,res)=>{
    try {
      const url = new URL(req.url,'http://127.0.0.1');
      let pathname;
      try {pathname=url.pathname;for(let i=0;i<3;i++){const decoded=decodeURIComponent(pathname);if(decoded===pathname)break;pathname=decoded;}pathname=pathname.replace(/\\/g,'/').replace(/\/+/g,'/');} catch {return json(res,{ok:false,error:'Invalid path'},400);}
      const method=req.method||'GET';
      const cookieRole=req.headers.cookie?.match(/(?:^|;\s*)mv_review_role=(teacher|student|guest)/)?.[1];
      const role=cookieRole||defaultRole;
      const current=role==='guest'?null:data.users.find(user=>user.email===(role==='teacher'?teacherEmail:studentEmail));
      const session=current?{email:current.email,name:current.name,nickname:current.nickname,role:current.role,avatarUrl:current.avatarUrl,avatarColor:current.avatarColor}:null;
      if(pathname.startsWith('/__review/role/')) {const nextRole=pathname.split('/').pop();if(!['teacher','student','guest'].includes(nextRole))return json(res,{ok:false},400);res.writeHead(303,{'Location':'/','Set-Cookie':`mv_review_role=${nextRole}; Path=/; HttpOnly; SameSite=Lax`,'Cache-Control':'no-store'});return res.end();}
      if(pathname==='/__review/reset') {data=seed();failures.clear();return json(res,{ok:true,fixture:true});}
      if(pathname==='/__review/fail') {const target=url.searchParams.get('path');const status=Number(url.searchParams.get('status')||503);if(!target?.startsWith('/api/'))return json(res,{ok:false,error:'Expected /api/ path'},400);if(status===0)failures.delete(target);else if(status>=400&&status<=599)failures.set(target,status);else return json(res,{ok:false},400);return json(res,{ok:true,failures:Object.fromEntries(failures)});}
      if(pathname==='/__review/empty') {const resource=url.searchParams.get('resource');if(['posts','lessons','contests','notifications'].includes(resource))data[resource]=[];else if(resource==='leaderboard')data.users=data.users.filter(user=>user.role==='teacher');else return json(res,{ok:false},400);return json(res,{ok:true,resource});}
      if(pathname==='/__review/stats')return json(res,{ok:true,...stats});
      if(/^\/__review\/art\/\d+\.svg$/.test(pathname)||pathname==='/api/avatars'||pathname==='/_next/image') {const id=Number(pathname.match(/(\d+)\.svg$/)?.[1]||1);res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'no-store','X-Mindverse-Review':'fixture-only'});return res.end(imageSVG(id));}
      if(pathname==='/__review'||pathname==='/__review/') {res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end('<h1>Mindverse local UI review</h1><p>Every API request uses local fixture data. No API request is proxied.</p><p><a href="/__review/role/teacher">Teacher</a> · <a href="/__review/role/student">Student</a> · <a href="/__review/role/guest">Guest</a> · <a href="/__review/reset">Reset fixtures</a></p><p>Student: review@example.test; Teacher: teacher@example.test; password: review123</p><p><a href="/admin">Admin</a> · <a href="/leaderboard">Leaderboard</a> · <a href="/lessons/review-lesson">Lesson</a> · <a href="/contests/review-contest">Contest</a></p>');}
      // Block every decoded API path before proxy logic, including unknown methods/routes.
      if(pathname==='/api'||pathname.startsWith('/api/')) {
        stats.handledApi++;
        if(failures.has(pathname))return json(res,{ok:false,error:'Зориудаар үүсгэсэн local fixture алдаа. Дахин оролдоно уу.'},failures.get(pathname));
        let body={};
        if(!['GET','HEAD'].includes(method)) {stats.mutations++;let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2_000_000)return json(res,{ok:false,error:'Fixture body too large'},413);}if(raw){try{body=JSON.parse(raw);}catch{return json(res,{ok:false,error:'Fixture accepts JSON only'},400);}}}
        const ok=value=>json(res,{ok:true,...value});
        const denied=()=>json(res,{ok:false,error:'Багшийн эрх шаардлагатай (fixture)'},403);
        if(pathname==='/api/auth/me'&&method==='GET')return ok({session});
        if(pathname==='/api/auth/login'&&method==='POST') {const user=data.users.find(u=>u.email===body.email);if(!user||body.password!=='review123')return json(res,{ok:false,error:'Use fixture account with password review123'},401);return json(res,{ok:true,session:user},200,{'Set-Cookie':`mv_review_role=${user.role}; Path=/; HttpOnly; SameSite=Lax`});}
        if(pathname==='/api/auth/logout'&&method==='POST')return json(res,{ok:true},200,{'Set-Cookie':'mv_review_role=guest; Path=/; HttpOnly; SameSite=Lax'});
        if(['/api/auth/send-reset-code','/api/auth/reset-password'].includes(pathname)&&method==='POST')return ok({message:'Local fixture only; no email sent.'});
        if(pathname==='/api/leaderboard'&&method==='GET')return ok({leaderboard:data.users.filter(u=>u.role==='student'&&(!url.searchParams.get('grade')||u.grade===url.searchParams.get('grade'))).sort((a,b)=>b.experience-a.experience)});
        if(pathname==='/api/admin/students'&&method==='GET')return session?.role==='teacher'?ok({students:data.users.filter(u=>u.role==='student')}):denied();
        if(pathname==='/api/user'&&method==='GET') {const user=data.users.find(u=>u.email===(url.searchParams.get('email')||session?.email));return user?ok({user}):json(res,{ok:false,error:'Fixture user not found'},404);}
        if(pathname==='/api/user/update'&&['POST','PUT','PATCH'].includes(method)) {if(!current)return json(res,{ok:false},401);for(const key of ['name','nickname','bio','grade','avatarColor','avatarUrl'])if(key in body)current[key]=body[key];return ok({user:current,session:current});}
        if(pathname.startsWith('/api/admin/')&&!['GET','HEAD'].includes(method)) {
          if(session?.role!=='teacher')return denied();
          if(pathname==='/api/admin/manage-xp'&&method==='POST') {const targets=data.users.filter(u=>u.role==='student'&&(body.applyToAll?(!body.targetGrade||u.grade===body.targetGrade):u.email===body.studentEmail));targets.forEach(u=>u.experience=Math.max(0,body.action==='set'?Number(body.amount):u.experience+Number(body.amount)));return ok({user:targets[0],count:targets.length,message:`${targets.length} сурагчийн XP шинэчлэгдлээ (local fixture).`});}
          if(pathname==='/api/admin/delete-student'&&method==='DELETE') {data.users=data.users.filter(u=>u.email!==body.studentEmail);data.posts=data.posts.filter(p=>p.authorEmail!==body.studentEmail);return ok({success:true,message:'Сурагч local fixture-ээс устлаа.'});}
          if(pathname==='/api/admin/reset-password'&&method==='POST')return ok({message:'Нууц үг шинэчлэгдлээ (local fixture only).'});
        }
        if(pathname==='/api/posts'&&method==='GET') {let posts=data.posts.filter(p=>p.visibility==='PUBLIC'||p.authorEmail===session?.email);const id=url.searchParams.get('id'),grade=url.searchParams.get('grade'),q=url.searchParams.get('search')?.toLowerCase(),before=url.searchParams.get('before');if(id)posts=posts.filter(p=>p.id===id);if(grade)posts=posts.filter(p=>p.authorGrade===grade);if(q)posts=posts.filter(p=>(p.title+' '+p.description).toLowerCase().includes(q));if(before)posts=posts.filter(p=>p.createdAt<before);return ok({posts:posts.slice(0,Number(url.searchParams.get('limit')||20))});}
        if(pathname.startsWith('/api/posts/user/')&&method==='GET')return ok({posts:data.posts.filter(p=>p.authorEmail===pathname.split('/').pop())});
        if(pathname==='/api/posts'&&method==='POST') {const post={...data.posts[0],...body,id:`review-post-${randomUUID()}`,authorEmail:session?.email,author:session?.name,createdAt:iso(),reactions:[],commentCount:0};data.posts.unshift(post);return ok({post});}
        if(pathname==='/api/posts'&&method==='PATCH') {
          if(!session)return json(res,{ok:false,error:'Нэвтэрнэ үү'},401);
          const id=url.searchParams.get('id');
          const title=typeof body?.title==='string'?body.title.trim():'';
          const description=typeof body?.description==='string'?body.description.trim():'';
          if(!id||id.length>200||title.length<3||title.length>200||description.length<10||description.length>2000)return json(res,{ok:false,error:'Гарчиг 3–200, тайлбар 10–2000 тэмдэгттэй байна.'},400);
          if(body.imageUrl!==undefined&&body.imageUrl!==null&&(typeof body.imageUrl!=='string'||body.imageUrl.length>10_000_000))return json(res,{ok:false,error:'Зургийн утга буруу эсвэл хэт том байна.'},400);
          const post=data.posts.find(p=>p.id===id&&p.authorEmail===session.email);
          if(!post)return json(res,{ok:false,error:'Бүтээл олдсонгүй эсвэл засах эрхгүй байна.'},404);
          // Update only editable fields so IDs, ownership, dates and engagement survive.
          post.title=title;post.description=description;
          if(body.imageUrl!==undefined)post.imageUrl=body.imageUrl;
          return ok({post});
        }
        if(pathname==='/api/posts'&&method==='DELETE') {data.posts=data.posts.filter(p=>p.id!==url.searchParams.get('id'));return ok({});}
        if(pathname==='/api/posts/react'&&method==='POST') {const post=data.posts.find(p=>p.id===url.searchParams.get('id'));if(!post)return json(res,{ok:false},404);const existing=post.reactions.find(r=>r.userEmail===session?.email);const removed=existing?.type===body.type;post.reactions=post.reactions.filter(r=>r.userEmail!==session?.email);if(!removed)post.reactions.push({userEmail:session?.email,type:body.type||'FIRE'});post.points=post.reactions.length;return ok({added:!existing,removed,updated:!!existing&&!removed});}
        if(pathname==='/api/posts/comments/counts'&&method==='GET')return ok({counts:Object.fromEntries((url.searchParams.get('ids')||'').split(',').map(id=>[id,data.comments.filter(c=>c.postId===id).length]))});
        if(pathname==='/api/posts/comments'&&method==='GET')return ok({comments:data.comments.filter(c=>c.postId===url.searchParams.get('postId'))});
        if(pathname==='/api/posts/comments'&&method==='POST') {const comment={id:randomUUID(),postId:body.postId,content:body.content,authorEmail:session?.email,authorName:session?.name,author:session?.name,createdAt:iso(),isAI:false};data.comments.push(comment);return ok({comment});}
        if(pathname==='/api/notifications'&&method==='GET')return ok({notifications:data.notifications,unreadCount:data.notifications.filter(n=>!n.read).length});
        if(pathname==='/api/notifications/mark-read'&&method==='POST') {data.notifications.forEach(n=>n.read=true);return ok({});}
        if(pathname==='/api/notifications/clear'&&method==='POST') {data.notifications=[];return ok({});}
        for(const [kind,collection] of [['lessons',data.lessons],['contests',data.contests]]) {
          if(pathname===`/api/${kind}`&&method==='GET')return ok({[kind]:collection});
          if(pathname===`/api/${kind}`&&method==='POST') {if(session?.role!=='teacher')return denied();const item={...collection[0],...body,id:`review-${kind}-${randomUUID()}`,authorEmail:session.email,authorName:session.name,submissions:[],createdAt:iso(),updatedAt:iso()};collection.push(item);return ok({[kind==='lessons'?'lesson':'contest']:item});}
          const match=pathname.match(new RegExp(`^/api/${kind}/([^/]+)(?:/(submit|grade|vote))?$`));
          if(!match)continue;const item=collection.find(i=>i.id===match[1]);if(!item)return json(res,{ok:false,error:'Fixture item not found'},404);const key=kind==='lessons'?'lesson':'contest';
          if(!match[2]&&method==='GET')return ok({[key]:item});
          if(!match[2]&&method==='PUT') {if(session?.role!=='teacher')return denied();Object.assign(item,body,{updatedAt:iso()});return ok({[key]:item});}
          if(!match[2]&&method==='DELETE') {if(session?.role!=='teacher')return denied();collection.splice(collection.indexOf(item),1);return ok({});}
          if(match[2]==='submit'&&method==='POST') {
            if(kind==='lessons') {
              if(!session)return json(res,{success:false,error:'Нэвтрэх шаардлагатай'},401);
              if(session.role!=='student')return json(res,{success:false,error:'Зөвхөн сурагчид даалгавар илгээнэ.'},403);
              const hasAnswers=body.answers!==undefined;
              const urls=body.fileUrls!==undefined?body.fileUrls:body.fileUrl!==undefined?[body.fileUrl]:undefined;
              if(urls!==undefined&&(!Array.isArray(urls)||urls.length<1||urls.length>2||urls.some(value=>typeof value!=='string'||!value)))return json(res,{success:false,error:'1–2 файл сонгоно уу'},400);
              if(!hasAnswers&&!urls)return json(res,{success:false,error:'Хариулт эсвэл даалгаврын файл илгээнэ үү'},400);
              if(hasAnswers&&(!Array.isArray(body.answers)||!item.questions.length||body.answers.length!==item.questions.length||body.answers.some((answer,index)=>!Number.isInteger(answer)||answer<0||answer>=item.questions[index].options.length)))return json(res,{success:false,error:'Бүх асуултад зөв форматтай хариулт сонгоно уу'},400);
              let submission=item.submissions.find(s=>s.studentEmail===session.email);
              if(!submission) {submission={id:randomUUID(),lessonId:item.id,studentEmail:session.email,studentName:session.name,submittedAt:iso()};item.submissions.push(submission);}
              if(urls&&JSON.stringify(submission.fileUrls||[])!==JSON.stringify(urls))Object.assign(submission,{fileUrl:urls[0],fileUrls:urls,submittedAt:iso(),score:null,feedback:null,gradedAt:null});
              if(hasAnswers) {
                const correct=item.questions.filter((question,index)=>body.answers[index]===question.correctAnswer).length;
                const score=Math.round(correct/item.questions.length*100);
                const feedback=`${correct}/${item.questions.length} зөв хариуллаа (${score}%).`;
                const previousXP=submission.rewardXP||0;
                const totalXP=Math.max(previousXP,score);
                const rewardXP=totalXP-previousXP;
                submission.rewardXP=totalXP;
                if(!submission.fileUrls?.length&&!submission.fileUrl)Object.assign(submission,{score,feedback,gradedAt:iso()});
                current.experience+=rewardXP;
                return ok({success:true,submission,score,rewardXP,feedback,message:`Үр дүнг хадгаллаа. ${feedback}${rewardXP?` +${rewardXP} XP.`:''}`});
              }
              return ok({success:true,submission,message:'Файлыг хүлээн авлаа. Багшийн үнэлгээг хүлээнэ үү.'});
            }
            const submission={id:randomUUID(),contestId:item.id,userEmail:session?.email,userName:session?.name,fileUrl:body.fileUrl||art(1),description:body.description||'',votes:[],submittedAt:iso()};
            item.submissions.push(submission);return ok({success:true,submission,[key]:item});
          }
          if(match[2]==='grade'&&method==='POST') {if(session?.role!=='teacher')return denied();const submission=item.submissions.find(s=>s.id===body.submissionId);if(!submission)return json(res,{ok:false},404);Object.assign(submission,{score:body.score,rewardXP:body.rewardXP,feedback:body.feedback,gradedAt:iso()});return ok({success:true,submission});}
          if(match[2]==='vote'&&method==='POST') {const submission=item.submissions.find(s=>s.id===body.submissionId);if(!submission)return json(res,{ok:false},404);submission.votes=submission.votes.includes(session?.email)?submission.votes.filter(e=>e!==session?.email):[...submission.votes,session?.email];return ok({contest:item});}
        }
        if(pathname==='/api/game/images'&&method==='GET')return ok(data.game);
        if(pathname==='/api/game/images/vote'&&method==='POST') {const image=data.game.images.find(i=>i.id===(body.id||body.imageId));if(image){image.likedBy=image.likedBy.includes(session?.email)?image.likedBy.filter(e=>e!==session?.email):[...image.likedBy,session?.email];image.likes=image.likedBy.length;}return ok({image,...data.game});}
        if(['/api/game/setup','/api/game/end','/api/game/reset'].includes(pathname)&&method==='POST') {if(session?.role!=='teacher')return denied();if(pathname.endsWith('reset'))data.game={...data.game,lessonId:null,gameEnded:false,images:[],rankings:[],winner:null};if(pathname.endsWith('setup'))data.game={...seed().game,lessonId:body.lessonId||'review-lesson',targetGrade:body.targetGrade||'10'};if(pathname.endsWith('end')){data.game.gameEnded=true;data.game.rankings=data.game.images.map((i,index)=>({email:i.addedBy,name:i.studentName,likes:i.likes,xp:100-index*25,rank:index+1}));data.game.winner=data.game.rankings[0]||null;}return ok(data.game);}
        if(pathname==='/api/spinner'&&method==='GET')return ok({options:data.options.map(o=>o.text),userOptionCount:data.options.filter(o=>o.email===session?.email).length});
        if(pathname==='/api/spinner'&&method==='POST') {if(!body.option?.trim())return json(res,{ok:false,error:'Сонголт оруулна уу'},400);if(data.options.filter(o=>o.email===session?.email).length>=2)return json(res,{ok:false,error:'2 сонголт нэмэх боломжтой'},400);data.options.push({text:body.option,email:session?.email});return ok({options:data.options.map(o=>o.text),userOptionCount:data.options.filter(o=>o.email===session?.email).length});}
        if(pathname==='/api/spinner'&&method==='DELETE') {if(session?.role!=='teacher')return denied();data.options=[];return ok({options:[]});}
        if(pathname==='/api/assistant/status'&&method==='GET')return ok({configured:true,provider:'fixture',model:'local-review',testOk:true});
        if(pathname==='/api/assistant/chat'&&method==='POST')return ok({reply:'Туршилтын зөвлөгөө: эхлээд гарчгаа тодруулж, дараа нь хоосон зайгаа шалгаарай.',message:'Local fixture response.'});
        if(pathname==='/api/fake-client'&&method==='GET') {const brief={id:'review-brief',clientName:'Review Studio',clientAvatar:'🎨',clientColor:'#8b5cf6',task:'Хоёр өнгөөр постер зохио.',requirements:['Тод гарчиг','Уншигдах текст'],challenge:'Хоосон зай ашигла.',category:'Poster',xpReward:25};return ok(url.searchParams.has('id')?{brief}:{briefs:[brief]});}
        stats.blockedApi++;return json(res,{ok:false,error:`Unimplemented local fixture: ${method} ${pathname}. Request was NOT forwarded.`,fixture:true},501);
      }
      if(!['GET','HEAD'].includes(method))return json(res,{ok:false,error:'Non-API mutations are blocked in review mode.'},405);
      stats.proxiedPages++;
      const headers={...req.headers,host:'127.0.0.1:3000'};delete headers.cookie;delete headers.authorization;
      const upstream=http.request({hostname:'127.0.0.1',port:3000,path:req.url,method,headers},response=>{
        const out={...response.headers,'X-Mindverse-Review':'fixture-only','Content-Security-Policy':"connect-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; form-action 'self'; frame-src 'none'"};delete out['set-cookie'];
        if(out.location?.startsWith('http://localhost:3000'))out.location=out.location.replace('http://localhost:3000','');
        if(out.location?.startsWith('http://127.0.0.1:3000'))out.location=out.location.replace('http://127.0.0.1:3000','');
        res.writeHead(response.statusCode||502,out);response.pipe(res);
      });
      upstream.setTimeout(20_000,()=>upstream.destroy(new Error('Upstream timeout')));
      upstream.on('error',()=>{if(!res.headersSent)json(res,{ok:false,error:'Start the Next app on127.0.0.1:3000 before opening review pages.'},502);else res.end();});upstream.end();
    } catch(error) {if(!res.headersSent)json(res,{ok:false,error:error.message,fixture:true},500);else res.end();}
  });
  return server;
}

async function selfTest() {
  const server=createReviewServer('teacher');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const call=async(path,method='GET',body,role='teacher')=>{const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:`mv_review_role=${role}`},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,value:await response.json()};};
  try {
    assert.equal((await call('/api/auth/me')).value.session.role,'teacher');
    assert.equal((await call('/api/auth/login','POST',{email:studentEmail,password:'review123'})).value.session.role,'student');
    assert.equal((await call('/api/auth/me','GET',null,'student')).value.session.email,studentEmail);
    assert.equal((await call('/api/posts?limit=10')).value.posts.length,10);
    await call('/api/posts/react?id=review-post-1','POST',{type:'LOVE'});
    const original=(await call('/api/posts?id=review-post-1')).value.posts[0];
    const edit={title:'  Edited review poster  ',description:' Updated local review description. ',id:'forged-id',createdAt:'forged-date',authorEmail:teacherEmail,reactions:[]};
    assert.equal((await call('/api/posts?id=review-post-1','PATCH',edit,'guest')).status,401);
    assert.equal((await call('/api/posts?id=review-post-1','PATCH',edit,'teacher')).status,404);
    assert.equal((await call('/api/posts?id=review-post-1','PATCH',{...edit,title:'x'},'student')).status,400);
    const edited=(await call('/api/posts?id=review-post-1','PATCH',edit,'student')).value.post;
    assert.equal(edited.title,'Edited review poster');assert.equal(edited.description,'Updated local review description.');
    for(const key of ['id','createdAt','authorEmail','imageUrl','commentCount','points'])assert.equal(edited[key],original[key]);
    assert.deepEqual(edited.reactions,original.reactions);assert.deepEqual(edited.comments,original.comments);
    const changedArt=(await call('/api/posts?id=review-post-1','PATCH',{...edit,imageUrl:art(8)},'student')).value.post;
    assert.equal(changedArt.imageUrl,art(8));
    const removedArt=(await call('/api/posts?id=review-post-1','PATCH',{...edit,imageUrl:null},'student')).value.post;
    assert.equal(removedArt.imageUrl,null);
    assert.deepEqual((await call('/api/posts?id=review-post-1')).value.posts[0],removedArt);
    assert.equal((await call('/api/leaderboard')).value.leaderboard.length,12);
    const changed=await call('/api/admin/manage-xp','POST',{studentEmail,action:'set',amount:777});assert.equal(changed.value.user.experience,777);
    assert.equal((await call('/api/user?email='+encodeURIComponent(studentEmail))).value.user.experience,777);
    assert.equal((await call('/api/admin/manage-xp','POST',{studentEmail,action:'set',amount:0},'student')).status,403);
    const lesson=(await call('/api/lessons/review-lesson')).value.lesson;assert.equal(lesson.questions.length,2);
    const submitted=await call('/api/lessons/review-lesson/submit','POST',{answers:[1,0]},'student');assert.equal(submitted.value.success,true);
    assert.equal(submitted.value.score,100);assert.equal(submitted.value.rewardXP,100);assert.match(submitted.value.message,/2\/2.*100%.*100 XP/);
    const repeated=await call('/api/lessons/review-lesson/submit','POST',{answers:[1,0]},'student');assert.equal(repeated.value.rewardXP,0);assert.equal(repeated.value.submission.id,submitted.value.submission.id);
    const partial=await call('/api/lessons/review-lesson/submit','POST',{answers:[0,0]},'student');assert.equal(partial.value.score,50);assert.equal(partial.value.rewardXP,0);
    assert.equal((await call('/api/lessons/review-lesson/submit','POST',{answers:[1]},'student')).status,400);
    assert.equal((await call('/api/lessons/review-lesson/submit','POST',{answers:[1,0]},'teacher')).status,403);
    const files=await call('/api/lessons/review-lesson/submit','POST',{fileUrls:[art(1)]},'student');
    assert.equal(files.value.success,true);assert.equal('score' in files.value,false);assert.equal('rewardXP' in files.value,false);
    assert.equal(files.value.submission.score,null);assert.equal(files.value.submission.id,submitted.value.submission.id);assert.match(files.value.message,/Багшийн үнэлгээг хүлээнэ/);
    assert.ok((await call('/api/contests/review-contest')).value.contest.submissions.length);
    assert.equal((await call('/api/game/images')).value.images.length,2);
    assert.equal((await call('/api/spinner')).value.options.length,3);
    assert.equal((await call('/api/definitely-unimplemented','POST',{dangerous:true})).status,501);
    assert.equal((await call('/api/definitely-unimplemented')).status,501);
    assert.equal((await call('/%61pi/definitely-unimplemented','POST',{dangerous:true})).status,501);
    assert.equal((await call('/some-page','POST',{dangerous:true})).status,405);
    assert.equal((await call('/api%252funimplemented','POST',{dangerous:true})).status,501);
    const stats=(await call('/__review/stats')).value;assert.equal(stats.proxiedPages,0);assert.equal(stats.blockedApi,4);
    console.log('PASS: fixture contracts; teacher/student sessions, ownership-checked post PATCH preserving identity and engagement, artwork update/removal, leaderboard, local XP mutation, student denial, quiz submission, contest/game/spinner, unknown and encoded API blocking. Zero upstream requests.');
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}

if(process.argv.includes('--self-test'))await selfTest();
else {const server=createReviewServer();server.listen(PORT,'127.0.0.1',()=>console.log(`Mindverse fixture review:http://127.0.0.1:${PORT}/__review/ (default:${roleArg}; every /api local; upstream pages only:3000)`));}
