export const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const regions = [
 {id:'amazon',name:'Amazon Basin',center:[-59,-9] as [number,number],spread:[16,9],peak:8,title:'A forest. A thousand signals.',copy:'Follow an illustrative dry-season rhythm across the southern Amazon. Compare the signals, then look beyond the count.'},
 {id:'africa',name:'Central Africa',center:[23,-5] as [number,number],spread:[12,13],peak:6,title:'The rhythm of a continent.',copy:'Explore a simulated seasonal pulse across central and southern Africa. A thermal signal is a starting point for investigation.'},
 {id:'asia',name:'Southeast Asia',center:[102,18] as [number,number],spread:[8,8],peak:2,title:'Small signals. Wider perspectives.',copy:'See how two instruments sample a shared landscape differently. More detected pixels do not necessarily mean more fires.'},
 {id:'australia',name:'Australia',center:[133,-23] as [number,number],spread:[17,11],peak:10,title:'Reading the northern season.',copy:'Move through a synthetic annual cycle and inspect individual observations across northern Australia.'},
 {id:'med',name:'Mediterranean',center:[19,39] as [number,number],spread:[18,4],peak:7,title:'At the edge of summer.',copy:'Explore illustrative summer activity across the Mediterranean. These are demonstration records, not incident reports.'},
];
export type Region = (typeof regions)[number];
